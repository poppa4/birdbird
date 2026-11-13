/* Birdbird front page: live 3D wind tunnel in the hero (three.js r128)
   Shows the real Virtual Labs scene from tunnel.html: the A320 with Cp on the surface, the dense streamlines
   (coloured by local speed V/V∞) and the tip-vortex cores. Nothing is computed here: the geometry and the
   traced streamlines are baked from the lab itself into data/hero-tunnel.bin.gz (tools/bake-hero-tunnel.py),
   and drawn with the lab's own materials from cfd3d.js. The poster image under the canvas is a ?shot render
   of tunnel.html from the same camera, so the swap from still to live is seamless.
   Loaded on demand by index.html (only when the hero is visible, WebGL works and motion is allowed). */
(function () {
  'use strict';
  const box = document.getElementById('objLab'), wrap = document.getElementById('hxTun'), cv = document.getElementById('hxTunCv');
  if (!box || !wrap || !cv || window.__heroTun) return;
  const API = window.__heroTun = { live: false, anchors: null };
  const DEG = Math.PI / 180, AP = 1400 / 1011;   // poster aspect; the live camera is framed for it and cropped like object-fit:cover
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });

  async function data(url) {
    const r = await fetch(url); if (!r.ok) throw new Error('hero data ' + r.status);
    let buf = await r.arrayBuffer(); const u = new Uint8Array(buf, 0, 2);
    if (u[0] === 0x1f && u[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x31544242) throw new Error('hero data format');
    const hl = dv.getUint32(4, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))), base = 8 + hl;
    const C = { Uint16Array, Uint8Array, Float32Array, Int16Array, Uint32Array };
    h.get = d => new C[d.type](buf, base + d.off, d.n);
    return h;
  }
  // inverse of the bake's delta + quantisation
  const undelta = (a, k) => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] + (i >= k ? o[i - k] : 0)) & 0xffff; return o; };
  const dequant = (h, a) => { const q = undelta(a, 3), o = new Float32Array(q.length), lo = h.q[0], sc = h.q[1]; for (let i = 0; i < q.length; i++) o[i] = lo[i % 3] + q[i] * sc[i % 3]; return o; };

  async function start() {
    if (!window.THREE) await load('three.min.js');
    if (!window.CFD) await load('cfd3d.js?v=7');
    const h = await data('data/hero-tunnel.bin.gz?v=3');
    const THREE = window.THREE, CFD = window.CFD;

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return; }
    const PRMAX = 1.75; let PR = Math.min(window.devicePixelRatio || 1, PRMAX);
    renderer.setPixelRatio(PR); renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = h.render.tm; renderer.toneMappingExposure = h.render.exp;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(h.render.fov, AP, 0.1, 400);
    scene.environment = CFD.studioEnv(THREE, renderer);
    for (const L of h.lights) {
      const l = L.t === 'HemisphereLight' ? new THREE.HemisphereLight(L.c, L.g, L.i) : new THREE.DirectionalLight(L.c, L.i);
      if (L.t !== 'HemisphereLight') l.position.fromArray(L.p); scene.add(l);
    }

    /* aircraft: same surface shader as the lab (Cp through the lab's colour map and range, as baked; thin isobars) */
    const cpU = { cmin: { value: -1.5 }, cmax: { value: 1 }, cmapId: { value: 1 }, iso: { value: 1 }, neutral: { value: 0.55 } };
    if (h.cpU) for (const k in cpU) if (h.cpU[k] != null) cpU[k].value = h.cpU[k];
    for (const m of h.meshes) {
      const g = new THREE.BufferGeometry(), idx = undelta(h.get(m.idx), 1);
      g.setAttribute('position', new THREE.BufferAttribute(dequant(h, h.get(m.pos)), 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
      let mat;
      if (m.isCp) {
        const c = undelta(h.get(m.cp), 1), cp = new Float32Array(c.length); for (let i = 0; i < c.length; i++) cp[i] = c[i] / 4000 - 3;
        g.setAttribute('cp', new THREE.BufferAttribute(cp, 1));
        mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, envMapIntensity: 0.35, side: THREE.DoubleSide });
        mat.onBeforeCompile = sh => {
          Object.assign(sh.uniforms, cpU);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cp; varying float vCp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCp=cp;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCp; uniform float iso;' + CFD.GLSL_CMAP)
            .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec3 cc=cmapN(cpT(clamp(vCp,cmin,cmax)));
              float f1=vCp*10.0, w1=fwidth(f1), d1=abs(fract(f1-0.5)-0.5);
              float f2=vCp*2.0, w2=fwidth(f2), d2=abs(fract(f2-0.5)-0.5);
              float l1=1.0-smoothstep(0.0,w1*1.1,d1), l2=1.0-smoothstep(0.0,w2*1.6,d2);
              cc*=1.0-iso*(0.07*l1*step(w1,0.45)+0.2*l2);
              vec4 diffuseColor=vec4(pow(cc,vec3(2.2)),opacity);`);
        };
        mat.extensions = { derivatives: true };
      } else mat = new THREE.MeshStandardMaterial({ color: m.map ? 0x30363d : m.color, roughness: m.rough, metalness: m.metal, envMapIntensity: m.env == null ? 1 : m.env, side: m.side });
      scene.add(new THREE.Mesh(g, mat));
    }

    /* streamlines and vortex cores: the lab's screen-space tube/ribbon materials and line geometry */
    const lineSet = (L, opt) => {
      const cnt = h.get(L.cnt), sd = h.get(L.sd), t0 = h.get(L.t0), P = dequant(h, h.get(L.pos)), cpq = undelta(h.get(L.cp), 1), dt = h.get(L.dt), fd = h.get(L.fd), tb = h.get(L.tb);
      const out = []; let k = 0;
      for (let i = 0; i < cnt.length; i++) {
        const n = cnt[i], l = { p: P.subarray(3 * k, 3 * (k + n)), cp: new Float32Array(n), t: new Float32Array(n), tb: new Float32Array(n), sd: sd[i] };
        let t = t0[i]; for (let j = 0; j < n; j++, k++) { if (j) t += dt[k] / 2000; l.t[j] = t; l.cp[j] = L.cmin + cpq[k] / 65535 * (L.cmax - L.cmin); l.tb[j] = tb[k] / 255 * 0.5; }
        out.push(l);
      }
      const g = CFD.lineGeometry(THREE, out, opt), F = g.attributes.fd.array;
      for (let i = 0; i < fd.length; i++) F[2 * i] = F[2 * i + 1] = fd[i] / 255;   // the lab's own fades, as traced
      return g;
    };
    const setU = (m, U) => { for (const k in U) { const u = m.uniforms[k]; if (!u || U[k] == null) continue; if (Array.isArray(U[k])) (u.value.isColor ? u.value.setRGB(...U[k]) : u.value.set(...U[k])); else u.value = U[k]; } };
    const mats = [];
    if (h.lines) { const m = CFD.tubeMaterial(THREE); setU(m, h.lineU); const o = new THREE.Mesh(lineSet(h.lines, { fadeIn: 1.6, fadeOut: 5 }), m); o.frustumCulled = false; o.renderOrder = 3; scene.add(o); mats.push(m); }
    if (h.cores) { const m = CFD.ribbonMaterial(THREE, {}); setU(m, h.coreU); const o = new THREE.Mesh(lineSet(h.cores, { fadeIn: 1e-3, fadeOut: 1e-3 }), m); o.frustumCulled = false; o.renderOrder = 6; scene.add(o); mats.push(m); }
    if (h.grid) { const g = CFD.gridFloor(THREE, h.grid.size); g.position.fromArray(h.grid.p); setU(g.material, h.grid.u); scene.add(g); }
    if (h.blob) {   // soft contact shadow, drawn like the lab's
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(128, 64, 4, 128, 64, 124);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.setTransform(1, 0, 0, 0.5, 0, 32); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(h.blob.w, h.blob.h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: h.blob.op, depthWrite: false }));
      b.rotation.set(...h.blob.rot); b.position.fromArray(h.blob.p); scene.add(b);
    }

    /* camera: the lab's orbit formula (updateCamera in tunnel.html) at the poster's aspect, then cropped to the box */
    const C0 = h.cam, T0 = new THREE.Vector3().fromArray(C0.t);
    let W = 0, H = 0;
    function size() {
      const r = box.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      renderer.setSize(W, H, false);
      for (const m of mats) if (m.uniforms.res) m.uniforms.res.value.set(W, H);
      // small boxes (phones): thinner lines, so the dense set reads as flow and not as hair
      if (mats[0] && h.lineU) mats[0].uniforms.width.value = h.lineU.width * Math.max(0.6, Math.min(1, W / 730));
      // object-fit: cover of an AP-shaped frame into W×H
      const fw = Math.max(W, H * AP), fh = fw / AP;
      camera.aspect = AP; camera.setViewOffset(fw, fh, (fw - W) / 2, (fh - H) / 2, W, H); camera.updateProjectionMatrix();
    }
    function place(th, ph, r) {
      const rr = r * Math.max(1, Math.pow(1.5 / Math.max(0.3, AP), 0.6)) * Math.tan(21 * DEG) / Math.tan(camera.fov / 2 * DEG);
      camera.position.set(T0.x + rr * Math.sin(ph) * Math.cos(th), T0.y + rr * Math.cos(ph), T0.z + rr * Math.sin(ph) * Math.sin(th));
      camera.lookAt(T0);
    }

    /* link anchors (dashed connectors from the other two boxes): wing upper surfaces and the tip-vortex cores */
    const AN = (h.anchors || []).map(a => new THREE.Vector3().fromArray(a)), pv = new THREE.Vector3();
    function anchors() {
      camera.updateMatrixWorld(); return AN.map(p => { pv.copy(p).project(camera); return [(pv.x + 1) / 2 * W, (1 - pv.y) / 2 * H, pv.z < 1]; }); }

    /* motion: a slow, eased sweep from the 3/4 front view round towards the side (tip vortices trailing), plus a little pointer parallax */
    let tw = 0, last = 0, raf = 0, vis = true, px = 0, py = 0, tpx = 0, tpy = 0, ft = 16, nf = 0;
    const SWEEP = 46;   // seconds per back-and-forth
    function frame(t) {
      raf = 0; if (!vis || document.hidden) { last = 0; return; }
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t; tw += dt;
      // weak GPU: after a couple of seconds of slow frames, drop to 1× resolution (once)
      if (dt > 0 && PR > 1) { ft = ft * 0.95 + dt * 1000 * 0.05; if (++nf > 120 && ft > 34) { PR = 1; renderer.setPixelRatio(PR); size(); } }
      for (const m of mats) m.uniforms.time.value = h.lineU.time + tw;
      px += (tpx - px) * Math.min(1, dt * 3); py += (tpy - py) * Math.min(1, dt * 3);
      const s = (1 - Math.cos(2 * Math.PI * tw / SWEEP)) / 2;   // 0 → 1 → 0, eased at both ends
      place(C0.th - 0.62 * s + 0.16 * px, C0.ph + 0.05 * s + 0.06 * py, C0.r * (1 + 0.05 * s));
      renderer.render(scene, camera);
      if (!API.live) { API.live = true; wrap.classList.add('live'); box.dispatchEvent(new CustomEvent('herotun:live')); }
      API.anchors = anchors(); box.dispatchEvent(new CustomEvent('herotun:frame'));
      raf = requestAnimationFrame(frame);
    }
    const go = () => { if (!raf && vis && !document.hidden) raf = requestAnimationFrame(frame); };
    size(); place(C0.th, C0.ph, C0.r);
    new ResizeObserver(() => { size(); if (!raf) { place(C0.th, C0.ph, C0.r); renderer.render(scene, camera); } }).observe(box);
    new IntersectionObserver(es => { vis = es[0].isIntersecting; go(); }).observe(box);
    document.addEventListener('visibilitychange', go);
    box.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = box.getBoundingClientRect(); tpx = (e.clientX - r.left) / r.width * 2 - 1; tpy = (e.clientY - r.top) / r.height * 2 - 1; }, { passive: true });
    box.addEventListener('pointerleave', () => { tpx = tpy = 0; });
    go();
  }
  start().catch(e => { console.warn('Hero wind tunnel: showing the still image', e && e.message || e); });
})();
