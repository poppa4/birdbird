"""Rasterise scr/*.svg with Chrome (2x), for compose.py."""
from playwright.sync_api import sync_playwright
import glob, os
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(device_scale_factor=2)
    for f in sorted(glob.glob('/home/claude/rend/scr/*.svg')):
        pg.set_content('<body style="margin:0;background:#000">' + open(f).read()); pg.locator('svg').screenshot(path=f[:-4] + '.png')
    b.close()
