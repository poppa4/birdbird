"""My Workspace desk in a real browser: empty desk, open a PDF, note beside with page references, split, drag, reload restores, quick open, desks, iPad and phone.
    python3 tests/desk_e2e.py [base-url] [shots-dir] [pdf]"""
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8976'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/ws2shots'
PDF = sys.argv[3] if len(sys.argv) > 3 else '/tmp/ws2fix/Trainer AFM.pdf'
os.makedirs(SHOTS, exist_ok=True)
def make_pdf(path):
    """an 18-page test manual: 'engine fire' on p. 7, 'crosswind' on p. 4 and 12"""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c = canvas.Canvas(path, pagesize=A4)
    secs = ['GENERAL','LIMITATIONS','EMERGENCY PROCEDURES','NORMAL PROCEDURES','PERFORMANCE','WEIGHT AND BALANCE']
    for i in range(1, 19):
        s = secs[(i-1)//3]
        c.setFont('Helvetica-Bold', 20); c.drawString(72, 770, f'SECTION {(i-1)//3+1} - {s}')
        c.setFont('Helvetica', 12)
        y = 730
        lines = [f'Page {i} of the trainer flight manual (test document).',
                 'Engine fire in flight: mixture idle cut-off, fuel selector off, master off.' if i == 7 else 'Normal text about the aircraft and its systems.',
                 'Maximum demonstrated crosswind 25 kt.' if i in (4, 12) else 'Airspeed limitations are shown in the table.',
                 'Stall speed clean 52 KIAS.' if i == 5 else '']
        for l in lines:
            c.drawString(72, y, l); y -= 20
        c.rect(72, 200, 450, 300)
        c.drawString(80, 480, f'Figure {i}')
        c.showPage()
    c.save()
if not os.path.exists(PDF): make_pdf(PDF)
URL = BASE + '/workspace.html'
res = []
def check(n, c, info=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(info)[:300]) if info and not c else ''))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1470, 'height': 956})
    errs = []
    def watch(pg):
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
    pg = ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.dk-empty .big3')
    check('desk is the default view', pg.is_visible('#wsDesk') and not pg.is_visible('.ws-head'))
    pg.wait_for_timeout(300); pg.screenshot(path=SHOTS + '/desk-empty.png')
    # add a PDF from the rail: it opens on the desk
    with pg.expect_file_chooser() as fc: pg.click('.dk-rail [data-b="add-doc"]')
    fc.value.set_files([PDF])
    pg.wait_for_selector('.dv-pages .pg canvas', timeout=30000)
    check('PDF opens on the desk with lazy pages', pg.locator('.dv-pages .pg').count() == 18 and pg.locator('.dv-pages .pg canvas').count() < 18, pg.locator('.dv-pages .pg canvas').count())
    # page jump
    pg.fill('.dv-pg input', '5'); pg.press('.dv-pg input', 'Enter'); pg.wait_for_timeout(400)
    check('page jump', pg.input_value('.dv-pg input') == '5')
    # note beside
    pg.click('.dv-nb'); pg.wait_for_selector('.nv-bd cite[data-doc]')
    check('note beside opens in a second pane', pg.locator('.dk-pane').count() == 2, pg.locator('.dk-pane').count())
    check('note starts with a page reference', 'p.' in pg.inner_text('.nv-bd cite') and '5' in pg.inner_text('.nv-bd cite'), pg.inner_text('.nv-bd'))
    pg.click('.nv-bd'); pg.keyboard.press('Control+End'); pg.keyboard.type('Check the stall speed here.')
    # go to page 7 in the PDF, cite it into the note
    pg.fill('.dv-pg input', '7'); pg.press('.dv-pg input', 'Enter'); pg.wait_for_timeout(300)
    pg.wait_for_selector('.dv-cite'); check('cite button names the page', '7' in pg.inner_text('.dv-cite'), pg.inner_text('.dv-cite'))
    pg.click('.dv-cite'); pg.wait_for_timeout(300)
    check('second page reference in the note', pg.locator('.nv-bd cite[data-doc]').count() == 2)
    # scroll PDF away then click the first reference: jumps back to p. 5
    pg.fill('.dv-pg input', '15'); pg.press('.dv-pg input', 'Enter'); pg.wait_for_timeout(300)
    pg.click('.nv-bd cite[data-doc] >> nth=0'); pg.wait_for_timeout(500)
    check('back-link jumps the PDF to its page', pg.input_value('.dv-pg input') == '5', pg.input_value('.dv-pg input'))
    # find in document
    pg.click('.dv-bar [data-a="find"]'); pg.fill('.dv-fin input', 'engine fire'); pg.press('.dv-fin input', 'Enter'); pg.wait_for_timeout(500)
    check('find in document goes to the match', pg.input_value('.dv-pg input') == '7' and '1 page' in pg.inner_text('.dv-fc'), pg.inner_text('.dv-fc') + ' ' + pg.input_value('.dv-pg input'))
    pg.wait_for_timeout(400)
    pg.screenshot(path=SHOTS + '/desk-split-pdf-note.png')
    # zoom
    pg.click('.dv-zoom [data-a="zin"]'); pg.wait_for_timeout(300)
    check('zoom in', '125%' in pg.inner_text('.dv-z'))
    # aircraft: add from the empty pane? use the library dialog via the palette command list -> open via Library is heavier; make one through the API
    pg.evaluate("""async () => { const W = window.WSCORE; const a = W.newAircraft({ typeKey: 'b200', reg: 'LN-TST' }); await window.WS.api.commit(a); window.WSDESK.openItem('aircraft', a.id, { beside: true }); }""")
    pg.wait_for_selector('.av-h .reg'); check('aircraft card opens with speeds table and sim button', 'LN-TST' in pg.inner_text('.av-h') and pg.locator('.av .speeds tbody tr').count() > 5 and pg.locator('.av-h a[href="b200.html"]').count() == 1)
    # split down via the pane menu (large screen; the bar keeps one split button) then drag the aircraft tab into the new pane
    pg.click('.dk-pane.act [data-pa="menu"]'); pg.click('.dk-menu button:has-text("Split down")'); pg.wait_for_timeout(200)
    check('three panes after split down', pg.locator('.dk-pane').count() == 3, pg.locator('.dk-pane').count())
    tab = pg.locator('.dk-tab:has-text("LN-TST")'); tb = tab.bounding_box()
    empty = pg.locator('.dk-pane.empty .dk-pb'); eb = empty.bounding_box()
    pg.mouse.move(tb['x'] + 20, tb['y'] + 10); pg.mouse.down(); pg.mouse.move(tb['x'] + 60, tb['y'] + 40, steps=4)
    pg.mouse.move(eb['x'] + eb['width'] * 0.4, eb['y'] + eb['height'] * 0.4, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    lay = pg.evaluate("() => window.DESKCORE.panes(window.WSDESK.layout).map(p => p.tabs.map(t => t.k))")
    check('tab dragged into the empty pane', lay == [['doc'], ['note'], ['aircraft']] or sorted(map(tuple, lay)) == [('aircraft',), ('doc',), ('note',)], lay)
    # pin the doc tab
    pg.click('.dk-tab:has-text("Trainer AFM")', button='right'); pg.click('.dk-menu button:has-text("Pin tab")')
    check('tab pinned', pg.locator('.dk-tab.pinned').count() == 1)
    # splitter by keyboard
    w0 = pg.evaluate("() => window.WSDESK.layout.root.w[0]")
    pg.focus('.dk-sp >> nth=0'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
    w1 = pg.evaluate("() => window.WSDESK.layout.root.w[0]")
    check('splitter moves with the keyboard', w1 > w0 + 0.05, (w0, w1))
    # quick open
    pg.keyboard.press('Escape'); pg.click('.nv-ttl'); pg.keyboard.press('Control+k'); pg.wait_for_selector('.pal-q')
    pg.fill('.pal-q', 'crosswind'); pg.wait_for_timeout(200)
    check('quick open finds text inside the PDF', pg.locator('.pal-l li:has-text("p. 4")').count() >= 1, pg.inner_text('.pal-l'))
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(1800)
    lay_before = pg.evaluate("() => window.DESKCORE.shape(window.WSDESK.layout)")
    page_before = pg.input_value('.dv-pg input')
    # reload: everything restored
    pg.reload(); pg.wait_for_selector('.dv-pages .pg canvas', timeout=30000); pg.wait_for_timeout(800)
    lay_after = pg.evaluate("() => window.DESKCORE.shape(window.WSDESK.layout)")
    check('layout restored exactly after reload', lay_before == lay_after, (lay_before, lay_after))
    check('PDF page and zoom restored', pg.input_value('.dv-pg input') == page_before and '125%' in pg.inner_text('.dv-z'), (pg.input_value('.dv-pg input'), page_before))
    check('note text kept', 'stall speed' in pg.inner_text('.nv-bd'))
    # desks: new, switch back, rename
    pg.click('.dk-deskbtn'); pg.click('.dk-menu button:has-text("New desk")'); pg.fill('#dkName', 'Next flight'); pg.press('#dkName', 'Enter')
    pg.wait_for_selector('.dk-empty .big3'); check('new desk starts empty', 'Next flight' in pg.inner_text('.dk-deskbtn'))
    pg.click('.dk-deskbtn'); pg.click('.dk-menu button[role=menuitemradio] >> nth=0'); pg.wait_for_selector('.dv-pages .pg')
    check('switching back restores the first desk', pg.locator('.dk-pane').count() == 3)
    pg.click('.dk-deskbtn'); pg.click('.dk-menu button:has-text("Rename")'); pg.fill('#dkName', 'B200 type rating'); pg.press('#dkName', 'Enter'); pg.wait_for_timeout(200)
    check('desk renamed', 'B200 type rating' in pg.inner_text('.dk-deskbtn'))
    n_desks = pg.evaluate("() => window.DESKCORE.desksOf(window.WS.state.items).map(d => d.name)")
    check('two desks stored as workspace items', sorted(n_desks) == ['B200 type rating', 'Next flight'], n_desks)
    # Library is still reachable
    pg.click('.dk-lib'); pg.wait_for_selector('.ovs'); check('library overview reachable', pg.is_visible('.ws-head') and not pg.is_visible('#wsDesk'))
    pg.click('.ws-rail a[href="#/"]'); pg.wait_for_selector('.dv-pages .pg canvas', timeout=20000)
    check('back to the desk, layout intact', pg.locator('.dk-pane').count() == 3)
    # Norwegian
    pg.click('.site .hright .seg button:has-text("NO")'); pg.wait_for_timeout(500)
    check('Norwegian desk', 'Notat ved siden av' in pg.inner_text('#wsDesk') or 'Arbeidsflate' in pg.inner_text('#wsDesk'), pg.inner_text('.dk-bar'))
    pg.screenshot(path=SHOTS + '/desk-no.png')
    pg.click('.site .hright .seg button:has-text("EN")'); pg.wait_for_timeout(300)
    # iPad size on this device (the stored PDF file itself cannot be copied into another browser context)
    pg.set_viewport_size({'width': 1024, 'height': 1366}); pg.wait_for_timeout(900)
    check('iPad size: PDF still drawn after resize', pg.locator('.dv-pages .pg canvas').count() > 0)
    pg.screenshot(path=SHOTS + '/desk-ipad-size.png')
    pg.set_viewport_size({'width': 1470, 'height': 956}); pg.wait_for_timeout(300)
    state = ctx.storage_state(indexed_db=True)
    # iPad
    ip = br.new_context(viewport={'width': 1024, 'height': 1366}, storage_state=state, is_mobile=True, has_touch=True, device_scale_factor=2)
    pi = ip.new_page(); watch(pi); pi.goto(URL); pi.wait_for_selector('.dk-pane', timeout=20000); pi.wait_for_timeout(1500)
    check('iPad: desk with panes', pi.locator('.dk-pane').count() >= 2, pi.locator('.dk-pane').count())
    ovf = pi.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"); check('iPad: no horizontal overflow', ovf <= 1, ovf)
    pi.screenshot(path=SHOTS + '/desk-ipad.png')
    # phone
    ph = br.new_context(viewport={'width': 430, 'height': 932}, storage_state=state, is_mobile=True, has_touch=True, device_scale_factor=3)
    pp = ph.new_page(); watch(pp); pp.goto(URL); pp.wait_for_selector('.dk-main.phone .dk-pane', timeout=20000); pp.wait_for_timeout(1200)
    check('phone: one pane with every tab in one strip', pp.locator('.dk-pane').count() == 1 and pp.locator('.dk-tab').count() == 3, pp.locator('.dk-tab').count())
    ovf = pp.evaluate("() => document.documentElement.scrollWidth - window.innerWidth"); check('phone: no horizontal overflow', ovf <= 1, ovf)
    pp.screenshot(path=SHOTS + '/phone.png')
    pp.tap('[data-b="switch"]'); pp.wait_for_selector('.dk-menu'); pp.tap('.dk-menu button:has-text("Notes:")'); pp.wait_for_selector('.nv-bd')
    check('phone: quick switch to the note', pp.is_visible('.nv-bd'))
    pp.screenshot(path=SHOTS + '/phone-note.png')
    pp.tap('[data-b="sheet"]'); pp.wait_for_selector('.dk-sheet.in .dk-it'); pp.wait_for_timeout(300)
    pp.screenshot(path=SHOTS + '/phone-library.png')
    pp.tap('.dk-sheet .dk-it:has-text("LN-TST")'); pp.wait_for_selector('.av-h')
    check('phone: library sheet opens an item', pp.is_visible('.av-h') and pp.locator('.dk-sheet:not([hidden])').count() == 0)
    check('no console errors', not errs, errs)
    br.close()
print('\n%d/%d passed' % (sum(1 for _, c in res if c), len(res)))
sys.exit(0 if all(c for _, c in res) else 1)
