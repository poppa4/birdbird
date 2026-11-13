"""Pen notebook, ink on a PDF and "Ask your documents" on the desk, in a real browser (desktop, iPad with touch, phone).
    python3 tests/notebook_e2e.py [base-url] [shots-dir] [pdf]"""
import os, sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8978'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/nbshots'
PDF = sys.argv[3] if len(sys.argv) > 3 else '/tmp/nbfix/Trainer AFM.pdf'
os.makedirs(SHOTS, exist_ok=True)
def make_pdf(path):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c = canvas.Canvas(path, pagesize=A4)
    for i in range(1, 9):
        c.setFont('Helvetica-Bold', 20); c.drawString(72, 770, f'SECTION {i} - TEST MANUAL')
        c.setFont('Helvetica', 12)
        c.drawString(72, 730, 'Maximum demonstrated crosswind 25 kt.' if i == 4 else 'Normal text about the aircraft and its systems.')
        c.drawString(72, 710, 'Engine fire in flight: mixture idle cut-off, fuel selector off.' if i == 6 else 'Airspeed limitations are shown in the table.')
        c.showPage()
    c.save()
if not os.path.exists(PDF): make_pdf(PDF)
URL = BASE + '/workspace.html'
res = []
def check(n, c, info=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(info)[:300]) if info and not c else ''))

STROKE_JS = """([sel, pts, type, pressure, id]) => {
  const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  const ev = (k, x, y) => new PointerEvent(k, { pointerId: id || 7, pointerType: type, isPrimary: true, pressure: k === 'pointerup' ? 0 : pressure, clientX: r.left + x * r.width, clientY: r.top + y * r.height, bubbles: true, cancelable: true, button: 0, buttons: k === 'pointerup' ? 0 : 1 });
  el.dispatchEvent(ev('pointerdown', pts[0][0], pts[0][1]));
  for (let i = 1; i < pts.length; i++) window.dispatchEvent(ev('pointermove', pts[i][0], pts[i][1]));
  window.dispatchEvent(ev('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]));
}"""
def line(x0, y0, x1, y1, n=24): return [[x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n + 0.01 * ((i % 3) - 1)] for i in range(n + 1)]
def stroke(pg, sel, pts, typ='pen', pressure=0.6, pid=7):
    pg.evaluate(STROKE_JS, [sel, pts, typ, pressure, pid]); pg.wait_for_timeout(60)
NB_JS = "() => { const it = Object.values(window.WS.state.items).find(x => x.kind === 'notebook' && !x.deletedAt); return it ? { id: it.id, pages: it.pages.map(p => ({ ink: p.ink.length, paper: p.paper || null, tx: (p.tx || []).length })), paper: it.paper, versions: (it.versions || []).length } : null; }"
def nb(pg): return pg.evaluate(NB_JS)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    def watch(pg):
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
    # ---------- desktop ----------
    ctx = br.new_context(viewport={'width': 1470, 'height': 956})
    pg = ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.dk-empty .big3')
    check('empty desk keeps three main cards and adds a quiet "New notebook"', pg.locator('.big3 button').count() == 3 and pg.locator('.more2 [data-e="nb"]').count() == 1)
    pg.click('.more2 [data-e="nb"]'); pg.wait_for_selector('.nb-pg canvas.base')
    pg.wait_for_timeout(300)
    check('notebook opens as a tab on grid paper', pg.locator('.dk-tab .tl').first.inner_text().startswith('Notebook') and nb(pg)['paper'] == 'grid', nb(pg))
    check('the page in view is the active page (touch-action none)', pg.evaluate("getComputedStyle(document.querySelector('.nb-pg.act')).touchAction") == 'none')
    S1 = '.nb-pg[data-i="0"] canvas.base'
    stroke(pg, S1, line(0.1, 0.1, 0.6, 0.15), 'pen', 0.3)
    stroke(pg, S1, line(0.1, 0.2, 0.6, 0.25), 'pen', 0.9)
    stroke(pg, S1, [[0.1 + 0.02 * i, 0.32 + 0.03 * ((-1) ** i)] for i in range(20)], 'mouse', 0.5, 1)
    pg.click('.nb-tools [data-tool="hl"]'); stroke(pg, S1, line(0.1, 0.4, 0.7, 0.4))
    pg.wait_for_timeout(900)
    n0 = nb(pg); check('four strokes (pen with pressure, mouse, highlighter) saved', n0['pages'][0]['ink'] == 4, n0)
    px = pg.evaluate("""() => { const c = document.querySelector('.nb-pg[data-i="0"] canvas.base'), x = c.getContext('2d'), w = c.width, h = c.height; const d = x.getImageData(Math.round(w * 0.35), Math.round(h * 0.125) - 6, 1, 12).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) dark++; return dark; }""")
    check('the pen stroke is drawn on the page canvas', px > 0, px)
    pg.screenshot(path=SHOTS + '/notebook-grid.png')
    # undo / redo
    pg.click('.nb-tools [data-a="undo"]'); pg.wait_for_timeout(800)
    check('undo removes the last stroke', nb(pg)['pages'][0]['ink'] == 3, nb(pg))
    pg.click('.nb-tools [data-a="redo"]'); pg.wait_for_timeout(800)
    check('redo brings it back', nb(pg)['pages'][0]['ink'] == 4)
    # stroke eraser across the first line
    pg.click('.nb-tools [data-tool="erase"]')
    stroke(pg, S1, line(0.35, 0.08, 0.35, 0.17, 8))
    pg.wait_for_timeout(800)
    check('stroke eraser removes the whole line it touches', nb(pg)['pages'][0]['ink'] == 3, nb(pg))
    pg.click('.nb-tools [data-a="undo"]'); pg.wait_for_timeout(800)
    check('undo restores the erased line', nb(pg)['pages'][0]['ink'] == 4, nb(pg))
    # partial eraser cuts the second line in two
    pg.click('.nb-em [data-em="part"]')
    stroke(pg, S1, line(0.35, 0.19, 0.35, 0.245, 8)); pg.wait_for_timeout(800)
    check('partial eraser splits a line into two pieces', nb(pg)['pages'][0]['ink'] == 5, pg.evaluate("() => { const it = Object.values(window.WS.state.items).find(x => x.kind === 'notebook'); return it.pages[0].ink.map(s => { const d = window.INKCORE.decodeStroke(s); const b = window.INKCORE.bbox(d); return [d.t, d.pts.length / 3, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)]; }); }"))
    # lasso around the mouse scribble, then delete
    pg.click('.nb-tools [data-tool="lasso"]')
    stroke(pg, S1, [[0.05, 0.27], [0.6, 0.27], [0.6, 0.37], [0.05, 0.37], [0.05, 0.27]] + [[0.05 + 0.001 * i, 0.27] for i in range(3)])
    pg.wait_for_timeout(200)
    check('lasso selects and offers Delete', pg.locator('.nb-del').count() == 1)
    pg.click('.nb-del'); pg.wait_for_timeout(800)
    check('lasso delete removes the selected scribble', nb(pg)['pages'][0]['ink'] == 4, nb(pg))
    pg.click('.nb-tools [data-tool="pen"]')
    # text box
    pg.click('.nb-tools [data-tool="text"]')
    stroke(pg, S1, [[0.12, 0.55], [0.12, 0.55]], 'mouse', 0.5, 1); pg.wait_for_timeout(150)
    pg.keyboard.type('ATIS Q: 270/12 9999 FEW030'); pg.wait_for_timeout(100)
    pg.click('.nb-tools [data-tool="pen"]'); pg.wait_for_timeout(900)
    check('a typed text box is kept on the page', nb(pg)['pages'][0]['tx'] == 1, nb(pg))
    # second page with the approach briefing template
    pg.click('.nb-th .nb-tadd'); pg.wait_for_selector('.nb-pg[data-i="1"]'); pg.wait_for_timeout(300)
    pg.click('.nb-th [data-pm="1"]'); pg.click('.dk-menu button:has-text("Paper")')
    pg.click('.dk-menu button:has-text("Approach briefing") >> nth=0'); pg.wait_for_timeout(900)
    check('page 2 uses the approach briefing template', nb(pg)['pages'][1]['paper'] == 'approach', nb(pg))
    pg.evaluate("document.querySelector('.nb-pg[data-i=\"1\"]').scrollIntoView()"); pg.wait_for_timeout(400)
    S2 = '.nb-pg[data-i="1"] canvas.base'
    stroke(pg, S2, line(0.2, 0.135, 0.5, 0.135)); stroke(pg, S2, line(0.2, 0.19, 0.42, 0.19), 'pen', 0.8)
    pg.wait_for_timeout(900)
    check('writing on the template page', nb(pg)['pages'][1]['ink'] == 2, nb(pg))
    pg.screenshot(path=SHOTS + '/notebook-approach.png')
    # zoom in, then reload: the notebook comes back on the same page and zoom
    pg.click('.nb-zoom [data-a="zin"]'); pg.wait_for_timeout(600)
    z0 = pg.inner_text('.nb-zoom .dv-z')
    pg.evaluate("document.querySelector('.nb-pg[data-i=\"1\"]').scrollIntoView()"); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_selector('.nb-pg canvas.base'); pg.wait_for_timeout(900)
    n1 = nb(pg)
    check('reload: the notebook tab, its strokes and template are restored', n1['pages'][0]['ink'] == 4 and n1['pages'][1]['ink'] == 2 and n1['pages'][1]['paper'] == 'approach', n1)
    check('reload: same zoom', pg.inner_text('.nb-zoom .dv-z') == z0, pg.inner_text('.nb-zoom .dv-z') + ' vs ' + z0)
    check('reload: same page', pg.evaluate("document.querySelector('.nb-pg.act') && document.querySelector('.nb-pg.act').dataset.i") == '1')
    check('text box restored as real text', 'ATIS Q' in pg.inner_text('.nb-pg[data-i="0"] .nb-tx'))
    check('rail lists the notebook under Notes', pg.locator('.dk-rail .dk-it[data-k="notebook"]').count() == 1)
    # export to PDF
    with pg.expect_download() as dl: pg.click('.nb-tools [data-a="more"]'); pg.click('.dk-menu button:has-text("Export as PDF")')
    path = dl.value.path(); head = open(path, 'rb').read()
    check('export notebook as PDF (header, two pages, xref)', head.startswith(b'%PDF-1.4') and head.count(b'/Type /Page ') == 2 and b'startxref' in head, len(head))
    # ---------- ink on a PDF ----------
    with pg.expect_file_chooser() as fc: pg.click('.dk-rail [data-b="add-doc"]')
    fc.value.set_files([PDF]); pg.wait_for_selector('.dv-pages .pg canvas.pdfc', timeout=30000); pg.wait_for_timeout(400)
    check('PDF toolbar has Annotate and Ask', pg.locator('.dv-ann').count() == 1 and pg.locator('.dv-ask').count() == 1)
    pg.click('.dv-ann'); pg.wait_for_selector('.nb-tools.ann')
    check('annotate mode: the page in view takes the pen (touch-action none)', pg.evaluate("getComputedStyle(document.querySelector('.dv-pages .pg.act')).touchAction") == 'none')
    pg.click('.nb-tools.ann [data-tool="pen"]'); pg.click('.nb-tools.ann [data-col="2"]')
    SP = '.dv-pages .pg[data-p="1"] canvas.pdfc'
    stroke(pg, SP, line(0.12, 0.11, 0.62, 0.11)); stroke(pg, SP, [[0.1 + 0.4 * i / 30, 0.2 + 0.03 * ((i % 4) - 2)] for i in range(31)], 'pen', 0.5)
    pg.click('.nb-tools.ann [data-tool="hl"]'); stroke(pg, SP, line(0.1, 0.067, 0.55, 0.067)); pg.wait_for_timeout(900)
    ink = pg.evaluate("() => { const it = Object.values(window.WS.state.items).find(x => x.kind === 'ink'); return it ? Object.fromEntries(Object.entries(it.pages).map(([k, v]) => [k, v.length])) : null; }")
    check('PDF ink stored per page, apart from the file', ink == {'1': 3}, ink)
    pg.screenshot(path=SHOTS + '/pdf-annotate.png')
    pg.click('.nb-tools.ann [data-a="done"]'); pg.wait_for_timeout(300)
    check('after Done the ink still shows over the page', pg.locator('.dv-pages .pg[data-p="1"] canvas.inkc').count() == 1)
    # ---------- ask ----------
    pg.click('.dv-ask'); pg.wait_for_selector('.ask'); pg.wait_for_timeout(1500)
    check('Ask opens beside the PDF, scoped to the open document', pg.locator('.ask-scope [data-s="doc"].on').count() == 1, pg.inner_text('.ask-bar'))
    check('without the AI service the tab explains calmly', pg.locator('.ask-off').count() == 1, pg.inner_text('.ask-log')[:200])
    pg.fill('.ask-f textarea', 'maximum crosswind'); pg.press('.ask-f textarea', 'Enter'); pg.wait_for_timeout(700)
    check('a question still finds the matching page', pg.locator('.ask-hits .ask-src').count() >= 1 and 'p. 4' in pg.inner_text('.ask-hits'), pg.inner_text('.ask-log')[-300:])
    pg.screenshot(path=SHOTS + '/ask-tab.png')
    pg.click('.ask-hits .ask-src >> nth=0'); pg.wait_for_timeout(600)
    check('a page chip jumps the PDF beside', pg.input_value('.dv-pg input') == '4', pg.input_value('.dv-pg input'))
    # palette commands
    pg.keyboard.press('Control+k'); pg.wait_for_selector('.pal-q'); pg.fill('.pal-q', 'notebook'); pg.wait_for_timeout(200)
    check('quick open finds "New notebook" and the notebook itself', 'New notebook' in pg.inner_text('.pal-l'), pg.inner_text('.pal-l'))
    pg.keyboard.press('Escape')
    # Norwegian
    pg.evaluate("window.LAB && window.LAB.setLang ? window.LAB.setLang('no') : null"); pg.wait_for_timeout(500)
    ctx.close()
    # ---------- iPad (touch + pen) ----------
    ctx = br.new_context(viewport={'width': 1024, 'height': 1366}, has_touch=True, is_mobile=False, device_scale_factor=2)
    pg = ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.dk-empty .big3'); pg.click('.more2 [data-e="nb"]'); pg.wait_for_selector('.nb-pg canvas.base'); pg.wait_for_timeout(300)
    for i in range(6): stroke(pg, S1, [[0.1 + 0.6 * j / 40, 0.08 + i * 0.05 + 0.012 * ((j % 6) - 3) / 3] for j in range(41)], 'pen', 0.3 + i * 0.12)
    # a finger (palm) after a pen was used does not draw
    stroke(pg, S1, line(0.2, 0.5, 0.7, 0.6), 'touch', 0.5, 11); pg.wait_for_timeout(900)
    check('iPad: pen strokes drawn, palm/finger ignored after the pen', nb(pg)['pages'][0]['ink'] == 6, nb(pg))
    check('iPad: finger switch is off once a pen is used', pg.locator('.nb-finger[disabled]').count() == 1)
    pg.click('.nb-tools [data-a="paper"]'); pg.click('.dk-menu button:has-text("Approach briefing") >> nth=0'); pg.wait_for_timeout(500)
    pg.screenshot(path=SHOTS + '/ipad.png')
    ctx.close()
    # ---------- phone ----------
    ctx = br.new_context(viewport={'width': 430, 'height': 932}, has_touch=True, is_mobile=True, device_scale_factor=3)
    pg = ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.dk-empty .big3'); pg.click('.more2 [data-e="nb"]'); pg.wait_for_selector('.nb-pg canvas.base'); pg.wait_for_timeout(300)
    # phone toolbar: one row with pen, highlighter, eraser, lasso, undo, redo and More; the tool's options in a second row
    row = pg.evaluate("""() => { const r1 = document.querySelector('.nb-r1'), vis = e => e.offsetParent !== null, bs = [...r1.querySelectorAll('button')].filter(vis);
      return { names: bs.map(b => b.dataset.tool || b.dataset.a), small: bs.filter(b => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 40).length,
        tops: [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))].length, rows: document.querySelector('.nb-tools').children.length, h: Math.round(document.querySelector('.nb-tools').getBoundingClientRect().height),
        opts: [...document.querySelectorAll('.nb-r2 button')].filter(vis).filter(b => b.getBoundingClientRect().height < 44).length } }""")
    check('phone: toolbar row is pen, highlighter, eraser, lasso, undo, redo, More on one line, 44 px', row['names'] == ['pen', 'hl', 'erase', 'lasso', 'undo', 'redo', 'tmore'] and row['small'] == 0 and row['tops'] == 1, row)
    check('phone: two rows at most (tools, then the pen\'s colours and sizes)', row['rows'] == 2 and row['h'] <= 100 and row['opts'] == 0, row)
    pg.click('.nb-tools [data-tool="lasso"]'); pg.wait_for_timeout(100)
    check('phone: a tool without options leaves one row, undo still there', pg.locator('.nb-r2').count() == 0 and pg.is_visible('.nb-tools [data-a="undo"]'))
    pg.click('.nb-tools [data-tool="pen"]')
    pg.click('.nb-tools [data-a="tmore"]'); pg.wait_for_selector('.dk-menu')
    items = pg.evaluate("[...document.querySelectorAll('.dk-menu button')].map(b => b.textContent)")
    check('phone: More holds text box, image, finger drawing, paper and the notebook menu', all(any(w in x for x in items) for w in ['Text box', 'Insert an image', 'Draw with a finger', 'Paper', 'Export as PDF', 'Move to trash']), items)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)   # on a phone the finger draws from the start
    stroke(pg, S1, line(0.1, 0.1, 0.8, 0.12), 'touch', 0.5, 21); pg.wait_for_timeout(900)
    check('phone: a finger draws from the start (no pen on a phone)', nb(pg)['pages'][0]['ink'] == 1, nb(pg))
    check('phone: no thumbnails strip, toolbar fits', not pg.is_visible('.nb-th') and pg.evaluate("document.querySelector('.nb-tools').scrollWidth <= document.querySelector('.nb-tools').clientWidth + 1"))
    pg.screenshot(path=SHOTS + '/phone.png')
    # Move to trash closes the notebook's tab
    nid = pg.evaluate("Object.values(WS.state.items).find(x => x.kind === 'notebook' && !x.deletedAt).id")
    pg.click('.nb-tools [data-a="tmore"]'); pg.click('.dk-menu button:has-text("Move to trash")'); pg.wait_for_timeout(600)
    check('Move to trash closes the notebook tab', pg.locator('.nb-pg').count() == 0 and pg.locator('.dk-tab').count() == 0 and pg.evaluate("!!WS.state.items['%s'].deletedAt" % nid), pg.locator('.dk-tab').count())
    ctx.close()
    br.close()
check('no console errors', not errs, errs[:5])
print('\n%d/%d passed' % (sum(1 for r in res if r[1]), len(res)))
sys.exit(0 if all(r[1] for r in res) else 1)
