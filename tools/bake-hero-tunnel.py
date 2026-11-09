#!/usr/bin/env python3
"""Re-bake the front-page wind tunnel (hero-tunnel.js) from the live Aerodynamics lab.

Run from the repo root with a local server on :8987 (python3 -m http.server 8987) and Playwright installed:
    python3 tools/bake-hero-tunnel.py
Writes data/hero-tunnel.bin.gz (airframe + Cp, streamlines, vortex cores, lights, camera) and the still
img/hero-tunnel.webp / img/hero-tunnel-800.webp (a ?shot render of tunnel.html from the same camera).
Run it again whenever the lab's model or look changes; then bump ?v= of the .bin.gz in hero-tunnel.js.
Another port: BAKE_URL=http://localhost:8988/ python3 tools/bake-hero-tunnel.py
The bake uses the lab's low-quality mesh (300 seed lines x dens 1.0), which equals ?shot with dens=1/3.
"""
import asyncio, base64, gzip, io, json, os, struct
from playwright.async_api import async_playwright
from PIL import Image
URL = os.environ.get('BAKE_URL', 'http://localhost:8987/'); ALPHA = 5; DENS = 1.0
CHROME = dict(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
BAKE_JS = r"""// runs in tunnel.html page context; returns {header, b64}
((KEEP, TOL) => {
  const T = window.__tun, THREE = window.THREE, sc = T.scene;
  sc.updateMatrixWorld(true);
  const arrays = []; let off = 0;
  const push = (name, ta) => { const pad = (4 - (off % 4)) % 4; off += pad; arrays.push({ name, ta, off, pad }); const d = { name, type: ta.constructor.name, off, n: ta.length }; off += ta.byteLength; return d; };
  const visible = o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
  // ---- airframe: merge by material signature
  const groups = new Map(); const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  sc.traverse(o => {
    if (!o.isMesh || !visible(o) || !o.material || o.material.type !== 'MeshStandardMaterial' && o.material.type !== 'MeshPhysicalMaterial') return;
    const m = o.material, g = o.geometry, isCp = !!g.attributes.cp && !!m.onBeforeCompile && m.onBeforeCompile.toString().includes('cmapN');
    const sig = isCp ? 'cp' : [m.color.getHexString(), m.roughness, m.metalness, m.map ? 1 : 0].join('|');
    if (!groups.has(sig)) groups.set(sig, { sig, isCp, color: '#' + m.color.getHexString(), rough: m.roughness, metal: m.metalness, env: m.envMapIntensity, side: m.side, map: !!m.map, pos: [], nrm: [], cp: [], idx: [] });
    const G = groups.get(sig), base = G.pos.length / 3, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.cp;
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); G.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); G.nrm.push(v.x, v.y, v.z);
      if (G.isCp) G.cp.push(C.getX(i));
    }
    const I = g.index; if (I) for (let i = 0; i < I.count; i++) G.idx.push(base + I.getX(i)); else for (let i = 0; i < P.count; i++) G.idx.push(base + i);
  });
  // bounds for quantisation
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const ext = (x, y, z) => { lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z); hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z); };
  for (const G of groups.values()) for (let i = 0; i < G.pos.length; i += 3) ext(G.pos[i], G.pos[i + 1], G.pos[i + 2]);
  // ---- streamlines (lineMesh: renderOrder 3, tube material)
  let lineMesh = null, coreMesh = null, grid = null, blob = null;
  sc.traverse(o => { if (!o.isMesh || !visible(o)) return; const u = o.material && o.material.uniforms;
    if (u && u.studio && o.renderOrder === 3) lineMesh = o; else if (u && u.dash && u.glow && u.dash.value > 0) coreMesh = o; else if (u && u.fadeR) grid = o; else if (o.material.type === 'MeshBasicMaterial' && o.material.map) blob = o; });
  const rib = (mesh, keepEvery) => {
    const g = mesh.geometry, A = g.attributes, I = g.index.array, nP = A.position.count / 2, link = new Uint8Array(nP);
    for (let q = 0; q < I.length; q += 6) link[I[q] / 2] = 1;   // pair k connects to k+1
    mesh.updateMatrixWorld(true); const M = mesh.matrixWorld, lines = []; let cur = [];
    for (let k = 0; k < nP; k++) { cur.push(k); if (!link[k]) { if (cur.length > 1) lines.push(cur); cur = []; } }
    const out = [];
    for (const L of lines) {
      // simplify: drop points that a straight segment (and linear cp/time) reproduces within tolerance
      const P = i => { v.fromBufferAttribute(A.position, 2 * i).applyMatrix4(M); return v.clone(); };
      const pts = L.map(P), cpA = L.map(i => A.cpv ? A.cpv.getX(2 * i) : 1), fdA = L.map(i => A.fd.getX(2 * i));
      const keep = [L[0]]; let a = 0;
      const ok = (a, b) => { const pa = pts[a], pb = pts[b], ab = pb.clone().sub(pa), l2 = ab.lengthSq() || 1e-12;
        for (let k = a + 1; k < b; k++) { const ap = pts[k].clone().sub(pa); const t = Math.max(0, Math.min(1, ap.dot(ab) / l2)); if (ap.sub(ab.clone().multiplyScalar(t)).length() > TOL) return false;
          const f = (k - a) / (b - a); if (Math.abs(cpA[a] + (cpA[b] - cpA[a]) * f - cpA[k]) > 0.006 || Math.abs(fdA[a] + (fdA[b] - fdA[a]) * f - fdA[k]) > 0.05) return false; }
        return pts[b].distanceTo(pa) < 1.2; };
      for (let j = 2; j < L.length; j++) { if (!ok(a, j)) { keep.push(L[j - 1]); a = j - 1; } }
      keep.push(L[L.length - 1]); out.push(keep.map(i => { const p = P(i); ext(p.x, p.y, p.z); const a = 2 * i;
        return [p.x, p.y, p.z, A.cpv ? A.cpv.getX(a) : 1, A.tv.getX(a), A.fd.getX(a), A.tbv ? A.tbv.getX(a) : 0, A.sd ? A.sd.getX(a) : 0]; }));
    }
    return out;
  };
  const lines = lineMesh ? rib(lineMesh, KEEP) : [], cores = coreMesh ? rib(coreMesh, 2) : [];
  const Q = [lo, hi.map((h, i) => (h - lo[i]) / 65534 || 1)];
  const qpos = arr => { const o = new Uint16Array(arr.length); for (let i = 0; i < arr.length; i++) { const c = i % 3; o[i] = Math.round((arr[i] - Q[0][c]) / Q[1][c]); } return o; };
  const delta3 = a => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] - (i >= 3 ? a[i - 3] : 0)) & 0xffff; return o; };
  const deltaIdx = a => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] - (i ? a[i - 1] : 0)) & 0xffff; return o; };
  const delta1 = a => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] - (i ? a[i - 1] : 0)) & 0xffff; return o; };
  const header = { v: 2, enc: 'delta', q: Q, meshes: [], lines: null, cores: null };
  for (const G of groups.values()) {
    const nr = new Int8Array(G.nrm.length); for (let i = 0; i < nr.length; i++) nr[i] = Math.round(G.nrm[i] * 127);
    const d = { sig: G.sig, isCp: G.isCp, color: G.color, rough: G.rough, metal: G.metal, env: G.env, side: G.side, map: G.map,
      pos: push('pos', delta3(qpos(G.pos))), idx: push('idx', deltaIdx(G.idx)) };
    if (G.isCp) { const c = new Uint16Array(G.cp.length); for (let i = 0; i < c.length; i++) c[i] = Math.round((Math.max(-3, Math.min(1.5, G.cp[i])) + 3) * 4000) & 0xffff; d.cp = push('cp', delta1(c)); }
    header.meshes.push(d);
  }
  const packLines = (L, name) => {
    const n = L.reduce((s, l) => s + l.length, 0), cnt = new Uint16Array(L.length), sd = new Float32Array(L.length), pos = [], cp = new Uint16Array(n), tv = new Float32Array(n), fd = new Uint8Array(n), tb = new Uint8Array(n);
    let tmax = 0, cmin = 1e9, cmax = -1e9; for (const l of L) for (const p of l) { cmin = Math.min(cmin, p[3]); cmax = Math.max(cmax, p[3]); }
    let k = 0; L.forEach((l, i) => { cnt[i] = l.length; sd[i] = l[0][7]; for (const p of l) { pos.push(p[0], p[1], p[2]); cp[k] = Math.round((p[3] - cmin) / ((cmax - cmin) || 1) * 65535); tv[k] = p[4]; fd[k] = Math.round(Math.max(0, Math.min(1, p[5])) * 255); tb[k] = Math.round(Math.max(0, Math.min(1, p[6] / 0.5)) * 255); k++; } });
    // flow time: store as delta per point (float16-ish via uint16 of delta*1000) to keep size small
    const dt = new Uint16Array(n); k = 0; const t0 = new Float32Array(L.length);
    L.forEach((l, i) => { t0[i] = l[0][4]; for (let j = 0; j < l.length; j++, k++) dt[k] = j ? Math.min(65535, Math.round((l[j][4] - l[j - 1][4]) * 2000)) : 0; });
    return { n, cmin, cmax, cnt: push(name + 'cnt', cnt), sd: push(name + 'sd', sd), t0: push(name + 't0', t0), pos: push(name + 'pos', delta3(qpos(pos))), cp: push(name + 'cp', delta1(cp)), dt: push(name + 'dt', dt), fd: push(name + 'fd', fd), tb: push(name + 'tb', tb) };
  };
  if (lines.length) header.lines = packLines(lines, 'l');
  if (cores.length) header.cores = packLines(cores, 'c');
  const U = m => { const o = {}; for (const k in m.uniforms) { const v = m.uniforms[k].value; o[k] = v && v.isVector2 ? null : v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isColor ? [v.r, v.g, v.b] : v; } return o; };
  header.lineU = lineMesh && U(lineMesh.material); header.coreU = coreMesh && U(coreMesh.material);
  // surface Cp colour map and range as the lab draws them (cmapId 1 = Turbo, 0 = cool-warm)
  header.cpU = T.cpU ? Object.fromEntries(Object.entries(T.cpU).map(([k, u]) => [k, u.value])) : null;
  header.grid = grid && { p: grid.position.toArray(), size: grid.geometry.parameters.width, u: U(grid.material) };
  header.blob = blob && { p: blob.getWorldPosition(new THREE.Vector3()).toArray(), s: blob.getWorldScale(new THREE.Vector3()).toArray(), w: blob.geometry.parameters.width, h: blob.geometry.parameters.height, op: blob.material.opacity, rot: blob.rotation.toArray().slice(0, 3) };
  const lights = []; sc.traverse(o => { if (o.isLight && o.visible) lights.push({ t: o.type, c: '#' + o.color.getHexString(), g: o.groundColor ? '#' + o.groundColor.getHexString() : null, i: o.intensity, p: o.position.toArray() }); });
  header.lights = lights;
  { const w = T.wing(), ov = T.overlay; ov.updateMatrixWorld(true); const A = [];
    for (const sg of [1, -1]) { const y = 0.42 * w.s, c = w.chord(y); A.push(ov.localToWorld(new THREE.Vector3(w.xle(y) + 0.35 * c, w.zw(y) + 0.05 * c, sg * y)).toArray()); }
    for (const sg of [1, -1]) { const y = 0.97 * w.s, c = w.chord(y); A.push(ov.localToWorld(new THREE.Vector3(w.xle(y) + 0.6 * c, w.zw(y) + 0.03 * c, sg * y)).toArray()); }
    header.anchors = A; }
  T.camTo('hero'); const R = T.renderer, cam0 = T.cam, cam = { th: cam0.tth, ph: cam0.tph, r: cam0.tr, tx: cam0.tx, ty: cam0.ty, tz: cam0.tz }, res = T.res(), st = T.st;
  header.render = { tm: R.toneMapping, exp: R.toneMappingExposure, fov: T.camera.fov };
  header.cam = { th: cam.th, ph: cam.ph, r: cam.r, t: [cam.tx, cam.ty, cam.tz] };
  header.state = { alpha: res.alpha, CL: res.CL, ias: st.ias, ac: st.ac };
  header.counts = { meshVerts: header.meshes.reduce((s, m) => s + m.pos.n / 3, 0), linePts: header.lines && header.lines.n, lines: lines.length, cores: cores.length };
  const buf = new Uint8Array(off); for (const a of arrays) buf.set(new Uint8Array(a.ta.buffer, a.ta.byteOffset, a.ta.byteLength), a.off);
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { header, b64: btoa(s) };
})(3, 0.004)
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**CHROME)
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script("Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4})")   # lab's light mesh
        pg = await ctx.new_page()
        await pg.goto(URL + 'tunnel.html#tunnel')
        await pg.evaluate("document.getElementById('vp').scrollIntoView()")
        await pg.wait_for_function("window.__tun&&__tun.ready()", timeout=90000)
        await pg.evaluate("(q)=>{ const T=__tun; Object.assign(T.st,{mode:'alpha',alpha:q.a,dens:q.d,labels:false}); T.rebuild(); }", {'a': ALPHA, 'd': DENS})
        await pg.wait_for_timeout(1500); await pg.wait_for_function("__tun.ready()", timeout=90000)
        r = await pg.evaluate(BAKE_JS)
        hj = json.dumps(r['header'], separators=(',', ':')).encode(); hj += b' ' * ((4 - (len(hj) + 8) % 4) % 4)
        raw = b'BBT1' + struct.pack('<I', len(hj)) + hj + base64.b64decode(r['b64'])
        with open('data/hero-tunnel.bin.gz', 'wb') as f: f.write(gzip.compress(raw, 9, mtime=0))
        print('baked', r['header']['counts'])
        ctx2 = await b.new_context(viewport={'width': 1400, 'height': 1011}, device_scale_factor=1)
        pg = await ctx2.new_page()
        await pg.goto(URL + 'tunnel.html?shot&cam=hero&a=%s&dens=%.4f' % (ALPHA, DENS / 3))
        await pg.wait_for_function("window.__tun&&__tun.ready()", timeout=90000); await pg.wait_for_timeout(2500)
        im = Image.open(io.BytesIO(await pg.screenshot())).convert('RGB')
        im.save('img/hero-tunnel.webp', 'WEBP', quality=78, method=6)
        im.resize((800, 578), Image.LANCZOS).save('img/hero-tunnel-800.webp', 'WEBP', quality=80, method=6)
        await b.close()

asyncio.run(main())
