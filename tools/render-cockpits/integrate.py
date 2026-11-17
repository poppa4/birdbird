"""Put a rendered cockpit into flowsac.js: replaces the aircraft's definition. usage: integrate.py <dir> (with spec.py, out/targets.json, out/meta.json)"""
import sys, json, re, runpy, os, shutil
d = sys.argv[1]; S = runpy.run_path(os.path.join(d, 'spec.py')); M = json.load(open(os.path.join(d, 'out', 'meta.json'))); REPO = '/home/claude/bbmain'
src = open(REPO + '/flowsac.js').read(); V = S['JSVAR']
i = src.index(f'const {V} = {{'); j = src.index('\n]};', i) + 4 if not re.match(rf'const {V} = {{[^\n]*\n?[^\n]*img:', src[i:i + 3000], re.S) else src.index('} };', i) + 4
k = src.rfind('\n/* ', 0, i); k2 = src.rfind('*/', 0, i)
if k >= 0 and src[k2 + 2:i].strip() == '' and src[k:i].count('const ') == 0: i = k + 1          # replace the comment right above it too
if f'const {S["CONST"]} = [' in src[:i]:                                                          # an earlier table of this aircraft
    a = src.index(f'const {S["CONST"]} = ['); b = src.index('];', a) + 3; src = src[:a] + src[b:]; i -= b - a; j -= b - a
img = S['IMG']; block = f'''/* {S["TITLE"]}: a picture rendered from a 3D model, square-on to each panel. {S["CREDIT_LONG"]}
   The picture is a derived work under the same licence; the scripts that make it are in tools/render-cockpits/. What the displays
   show is NORDAP's own drawing. Each control's rectangle is computed from the model's geometry. */
{M["table"]}
const {V} = {{ id: '{S["ID"]}', name: '{S["TITLE"]}', {S.get("EXTRA", "")}crew: {S["CREW"]}, h: {M["h"]}, t: {S["CONST"]},
  img: {{ lo: 'img/cockpits/{S["NAME"]}-deck-1500.webp', hi: 'img/cockpits/{S["NAME"]}-deck-3000.webp', by: '{img["by"]}', lic: '{img["lic"]}', v: '{img.get("v", "")}', src: '{img["src"]}', licUrl: '{img["licUrl"]}' }} }};
'''
src = src[:i] + block + src[j:].lstrip('\n'); open(REPO + '/flowsac.js', 'w').write(src)
for w in (1500, 3000): shutil.copy(os.path.join(d, 'out', f'{S["NAME"]}-deck-{w}.webp'), f'{REPO}/img/cockpits/{S["NAME"]}-deck-{w}.webp')
print('integrated', S['ID'], len(M['table']), 'bytes of table, h', M['h'])
