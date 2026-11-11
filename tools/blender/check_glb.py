#!/usr/bin/env python3
"""Load each models/<ac>-cockpit.glb in models/test.html (the site's three.js r128 + GLTFLoader + meshopt decoder) in headless
Chromium with software GL; print triangle count, node check and errors; save a screenshot from the left-seat eye.
Usage: python3 tools/blender/check_glb.py [c172 b200 da42]   (env SHOTS=/tmp/gltfshots, PORT=8991)
"""
import asyncio, json, os, sys, subprocess, time
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
PORT = int(os.environ.get('PORT', 8991)); SHOTS = os.environ.get('SHOTS', '/tmp/gltfshots')
VIEWS = {'c172': (9, -16), 'b200': (13, -19), 'da42': (12, -18)}


async def main(acs):
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    ok = True
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for ac in acs:
                pg = await b.new_page(viewport={'width': 1280, 'height': 800})
                logs = []
                pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
                pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
                yaw, pitch = VIEWS.get(ac, (0, -15))
                extra = os.environ.get('EXTRA', '')
                await pg.goto(f'http://127.0.0.1:{PORT}/models/test.html?ac={ac}&yaw={yaw}&pitch={pitch}{extra}')
                await pg.wait_for_function('window.__result && window.__result.done', timeout=120000)
                await pg.wait_for_timeout(2500)
                await pg.evaluate('window.__draw && window.__draw()')
                r = await pg.evaluate('window.__result')
                os.makedirs(SHOTS, exist_ok=True)
                await pg.screenshot(path=f'{SHOTS}/{ac}-three.png')
                size = os.path.getsize(f'{ROOT}/models/{ac}-cockpit.glb')
                print(json.dumps({'ac': ac, 'bytes': size, 'triangles': r.get('triangles'), 'meshes': r.get('meshes'), 'draw_calls': r.get('calls'),
                                  'nodes': len(r.get('nodes', [])), 'missing': r.get('missing'), 'pivot_err_m': r.get('pivotErr'),
                                  'errors': r.get('errors'), 'console': logs, 'load_ms': r.get('loadMs')}))
                # extra views: SHOT_VIEWS="yaw,pitch[,fov];…" → <ac>-three-<i>.png
                for i, v in enumerate([x for x in os.environ.get('SHOT_VIEWS', '').split(';') if x]):
                    a = [float(t) for t in v.split(',')]
                    await pg.evaluate(f'(()=>{{ const c=window.__cam; c.rotation.set(({a[1]})*Math.PI/180,({-a[0]})*Math.PI/180,0,"YXZ"); if({len(a)}>2){{ c.fov={a[2] if len(a) > 2 else 62}; c.updateProjectionMatrix(); }} window.__draw(); }})()')
                    await pg.screenshot(path=f'{SHOTS}/{ac}-three-{i}.png')
                ok = ok and r.get('ok') and not [l for l in logs if 'error' in l]
                await pg.close()
            await b.close()
    finally:
        srv.terminate()
    return ok


if __name__ == '__main__':
    sys.exit(0 if asyncio.run(main(sys.argv[1:] or ['c172', 'b200', 'da42'])) else 1)
