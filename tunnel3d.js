/* Virtual Lab – vindtunnel 3D-hjelpere (three.js r128)
   Prosedyriske teksturer, testseksjon (lukket kretsløp), miljøkart og røykbånd-shader.
   Ingen eksterne ressurser: alt lages i kode/canvas. */
(function (root) {
  'use strict';
  const T3D = {};

  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function prng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000003) / 1000003; }; }
  function tex(THREE, c, rep, srgb) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  T3D.cv = cv; T3D.prng = prng;

  /* ---------- paneler med skjøter og nagler (vegger, gulv, tak) ---------- */
  T3D.panelTex = function (THREE, o) {
    const N = o.size || 512, rnd = prng(o.seed || 7);
    const c = cv(N, N), g = c.getContext('2d'), b = cv(N, N), h = b.getContext('2d');
    g.fillStyle = o.base; g.fillRect(0, 0, N, N);
    // flekker og slitasje
    for (let i = 0; i < 26; i++) {
      const x = rnd() * N, y = rnd() * N, r = 40 + rnd() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r);
      const d = rnd() < 0.5; gr.addColorStop(0, d ? 'rgba(0,0,0,' + (0.025 * (o.dirt || 1)) + ')' : 'rgba(255,255,255,0.018)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2, 1 + rnd() * 2); }
    if (o.streaks) for (let i = 0; i < 40; i++) { const y = rnd() * N; g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, y, N, 1 + rnd() * 3); }
    h.fillStyle = '#c8c8c8'; h.fillRect(0, 0, N, N);
    const cols = o.cols || 1, rows = o.rows || 1;
    const seam = (x0, y0, x1, y1) => {
      g.strokeStyle = o.seam || 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 2.5 * (y0 !== y1), y0 + 2.5 * (x0 !== x1)); g.lineTo(x1 + 2.5 * (y0 !== y1), y1 + 2.5 * (x0 !== x1)); g.stroke();
      h.strokeStyle = '#202020'; h.lineWidth = 4; h.beginPath(); h.moveTo(x0, y0); h.lineTo(x1, y1); h.stroke();
    };
    for (let i = 0; i <= cols; i++) { const x = i * N / cols; seam(x, 0, x, N); }
    for (let j = 0; j <= rows; j++) { const y = j * N / rows; seam(0, y, N, y); }
    if (o.rivet) {
      const sp = o.rivet;
      const dot = (x, y) => { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 0.6, y + 0.8, 2.4, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(x - 0.5, y - 0.5, 1.6, 0, 7); g.fill();
        h.fillStyle = '#f0f0f0'; h.beginPath(); h.arc(x, y, 2.6, 0, 7); h.fill(); };
      for (let i = 0; i <= cols; i++) for (let y = sp / 2; y < N; y += sp) { const x = i * N / cols; dot(x + 9, y); dot(x - 9, y); }
      for (let j = 0; j <= rows; j++) for (let x = sp / 2; x < N; x += sp) { const y = j * N / rows; dot(x, y + 9); dot(x, y - 9); }
    }
    return { map: tex(THREE, c, true, true), bump: tex(THREE, b, true, false) };
  };

  /* ---------- bikakegitter (flow straightener), sett langs aksen ---------- */
  T3D.honeycombTex = function (THREE) {
    const r = 9, dx = Math.sqrt(3) * r, nx = 24, W = Math.round(dx * nx), ny = 16, H = Math.round(1.5 * r * ny * 1), c = cv(W, H * 1), g = c.getContext('2d');
    g.fillStyle = '#1a1f25'; g.fillRect(0, 0, W, H);
    for (let j = -1; j <= ny + 1; j++) for (let i = -1; i <= nx + 1; i++) {
      const cx = i * dx + (j & 1 ? dx / 2 : 0), cy = j * 1.5 * r;
      const gr = g.createRadialGradient(cx, cy - 1, 0, cx, cy, r);
      gr.addColorStop(0, '#d6dde4'); gr.addColorStop(0.55, '#8f9aa5'); gr.addColorStop(1, '#3a434d');
      g.fillStyle = gr; g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const x = cx + (r - 1.2) * Math.cos(a), y = cy + (r - 1.2) * Math.sin(a); k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fill();
    }
    return tex(THREE, c, true, true);
  };

  /* ---------- observasjonsvindu: mørkt kontrollrom bak glasset ---------- */
  T3D.controlRoomTex = function (THREE) {
    const W = 512, H = 256, c = cv(W, H), g = c.getContext('2d'), rnd = prng(3);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05080b'); bg.addColorStop(0.6, '#0b1117'); bg.addColorStop(1, '#030507');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { // skjermer
      const x = 30 + i * 68 + rnd() * 10, y = 120 + rnd() * 20, w = 40 + rnd() * 16, h = 26 + rnd() * 8;
      const hue = rnd() < 0.5 ? '90,170,230' : '120,210,170';
      const gr = g.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w * 1.4);
      gr.addColorStop(0, 'rgba(' + hue + ',0.35)'); gr.addColorStop(1, 'rgba(' + hue + ',0)'); g.fillStyle = gr; g.fillRect(x - w, y - w, 3 * w, 3 * w);
      g.fillStyle = 'rgba(' + hue + ',0.55)'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 4; k++) g.fillRect(x + 4, y + 4 + k * 5, w * (0.3 + rnd() * 0.6), 1.5);
    }
    g.fillStyle = '#020304'; g.fillRect(0, 170, W, 90); // pult
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(0, 170, W, 2);
    return tex(THREE, c, false, true);
  };

  /* ---------- skrogdekor: hvit modellakk, lys grå buk, magenta stripe, vinduer og dører ----------
     u = x/L (nese→hale), v = (φ+π/2)/2π (bunn 0, høyre side 0,25, topp 0,5, venstre 0,75) */
  T3D.liveryTex = function (THREE, o) {
    const W = 2048, H = 512, c = cv(W, H), g = c.getContext('2d'), L = o.L;
    const U = x => x / L * W, V = v => (1 - v) * H; // canvas y=0 er v=1
    g.fillStyle = '#eef0f1'; g.fillRect(0, 0, W, H);
    // buk i lys grå (myk overgang)
    for (const [v0, v1] of [[0, 0.2], [0.8, 1]]) {
      const gr = g.createLinearGradient(0, V(v0), 0, V(v1));
      if (v0 === 0) { gr.addColorStop(0, '#c9ced3'); gr.addColorStop(0.75, '#d3d7db'); gr.addColorStop(1, 'rgba(238,240,241,0)'); }
      else { gr.addColorStop(0, 'rgba(238,240,241,0)'); gr.addColorStop(0.25, '#d3d7db'); gr.addColorStop(1, '#c9ced3'); }
      g.fillStyle = gr; g.fillRect(0, V(v1), W, V(v0) - V(v1));
    }
    // panelskjøter
    g.strokeStyle = 'rgba(60,70,80,0.13)'; g.lineWidth = 1;
    for (let x = 1.2; x < L; x += 1.55) { g.beginPath(); g.moveTo(U(x), 0); g.lineTo(U(x), H); g.stroke(); }
    for (const v of [0.12, 0.2, 0.36, 0.43, 0.57, 0.64, 0.8, 0.88]) { g.beginPath(); g.moveTo(U(0.6), V(v)); g.lineTo(W, V(v)); g.stroke(); }
    // magenta stripe på begge sider, sveiper opp mot halen
    const stripe = (side) => {
      const vS = side > 0 ? 0.245 : 0.755, sw = 0.018;
      g.fillStyle = o.stripe || '#9a1e68';
      g.beginPath();
      const pts = [];
      for (let i = 0; i <= 80; i++) { const x = 0.9 + (L - 1.6) * i / 80, t = Math.max(0, (x - L * 0.74) / (L * 0.26));
        const vc = vS + side * (0.17 * t * t); pts.push([x, vc]); }
      pts.forEach(([x, v], i) => { const yy = V(v + sw / 2); i ? g.lineTo(U(x), yy) : g.moveTo(U(x), yy); });
      for (let i = pts.length - 1; i >= 0; i--) { const [x, v] = pts[i], taper = Math.min(1, (x - 0.9) / 2.5); g.lineTo(U(x), V(v - sw / 2 * taper - sw / 2 * (1 - taper))); }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(154,30,104,0.65)'; g.lineWidth = 2; g.beginPath();
      pts.forEach(([x, v], i) => { const yy = V(v - side * 0.0) + (side > 0 ? 1 : -1) * 0; const y2 = V(v - sw * 0.95); i ? g.lineTo(U(x), y2) : g.moveTo(U(x), y2); });
      g.stroke();
    };
    stripe(1); stripe(-1);
    if (o.windows) {
      // kabinvinduer
      g.fillStyle = '#1d262f';
      for (const vW of [0.296, 0.704]) for (let x = 4.9; x < 30.4; x += 0.533) {
        if (x > 13.2 && x < 14.4) continue;
        const w = U(0.24), h = (0.022) * H, xx = U(x), yy = V(vW) - h / 2;
        g.beginPath(); g.ellipse(xx, yy + h / 2, w / 2, h / 2, 0, 0, 7); g.fill();
      }
      // dører (omriss)
      g.strokeStyle = 'rgba(70,80,92,0.55)'; g.lineWidth = 1.6;
      const door = (x0, x1, v0, v1) => { g.strokeRect(U(x0), V(v1), U(x1) - U(x0), V(v0) - V(v1)); };
      for (const s of [1, -1]) { const b = s > 0 ? 0.2 : 0.8, t = s > 0 ? 0.33 : 0.67;
        door(3.5, 4.35, Math.min(b, t), Math.max(b, t)); door(31.2, 31.95, Math.min(b, t), Math.max(b, t));
        door(13.3, 13.95, Math.min(s > 0 ? 0.27 : 0.73, s > 0 ? 0.32 : 0.68), Math.max(s > 0 ? 0.27 : 0.73, s > 0 ? 0.32 : 0.68)); }
      // cockpitvinduer
      g.fillStyle = '#141b22';
      const poly = (pp) => { g.beginPath(); pp.forEach(([x, v], i) => i ? g.lineTo(U(x), V(v)) : g.moveTo(U(x), V(v))); g.closePath(); g.fill(); };
      for (const s of [1, -1]) {
        const m = v => s > 0 ? v : 1 - v;
        poly([[1.55, m(0.395)], [2.05, m(0.36)], [2.1, m(0.46)], [1.65, m(0.49)]]);       // frontrute
        poly([[2.15, m(0.355)], [2.75, m(0.338)], [2.72, m(0.405)], [2.18, m(0.445)]]);  // sidevindu 1
        poly([[2.85, m(0.336)], [3.3, m(0.33)], [3.25, m(0.385)], [2.82, m(0.4)]]);      // sidevindu 2
      }
    }
    // tomotorsflyene: kabinvinduer (avrundede firkanter), frontrute eller kanopé
    if (o.cabin) {
      const cb = o.cabin, dx = (cb.x1 - cb.x0) / Math.max(1, cb.n - 1);
      g.fillStyle = '#1d262f';
      for (const vW of [0.25 + cb.z * 0.1 + 0.02, 0.75 - cb.z * 0.1 - 0.02]) for (let i = 0; i < cb.n; i++) {
        const xx = U(cb.x0 + i * dx), w = U(cb.w), h = cb.h * 0.11 * H, r = Math.min(w, h) * (cb.round || 0.3);
        const x0 = xx - w / 2, y0 = V(vW) - h / 2;
        g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r); g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath(); g.fill();
      }
    }
    if (o.cockpit) {
      const ck = o.cockpit; g.fillStyle = '#141b22';
      if (ck.canopy) {   // stor kanopé (DA42): mørk flate over toppen, med en rammelinje
        g.beginPath(); g.moveTo(U(ck.x0), V(0.47)); g.quadraticCurveTo(U(ck.x0 + 0.35), V(0.36), U(ck.x0 + 0.8), V(0.33));
        g.lineTo(U(ck.x1), V(0.36)); g.lineTo(U(ck.x1), V(0.64)); g.lineTo(U(ck.x0 + 0.8), V(0.67)); g.quadraticCurveTo(U(ck.x0 + 0.35), V(0.64), U(ck.x0), V(0.53)); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(200,210,220,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(U(ck.x0 + 0.95), V(0.33)); g.lineTo(U(ck.x0 + 0.95), V(0.67)); g.stroke();
      } else {           // frontrute og sidevinduer i cockpiten (King Air)
        const poly = pp => { g.beginPath(); pp.forEach(([x, v], i) => i ? g.lineTo(U(x), V(v)) : g.moveTo(U(x), V(v))); g.closePath(); g.fill(); };
        for (const sd of [1, -1]) { const m = v => sd > 0 ? v : 1 - v, a = ck.x0, b = ck.x1, L2 = b - a;
          poly([[a, m(0.42)], [a + 0.35 * L2, m(0.36)], [a + 0.42 * L2, m(0.49)], [a + 0.05 * L2, m(0.5)]]);
          poly([[a + 0.45 * L2, m(0.35)], [b, m(0.33)], [b - 0.03 * L2, m(0.41)], [a + 0.48 * L2, m(0.44)]]); }
      }
    }
    // registrering/logo-felt: diskré "BIRDBIRD LAB" i grått
    g.fillStyle = 'rgba(80,90,100,0.35)'; g.font = '600 15px Arial, sans-serif';
    g.save(); g.translate(U(6.5), V(0.34)); g.scale(1, -1); g.restore();
    const t = tex(THREE, c, false, true); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  /* ---------- vinge: klaff-/krengerorlinjer, spoilere, lameller ---------- */
  T3D.wingTex = function (THREE, o) {
    // u: 0..0,5 overside (bakkant→forkant), 0,5..1 underside (forkant→bakkant); v: spenn −s..s → 0..1
    const W = 1024, H = 1024, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#eceef0'; g.fillRect(0, 0, W, H);
    const U = (x, up) => (up ? 0.5 * (1 - x) : 0.5 + 0.5 * x) * W, Vv = f => (1 - (f + 1) / 2) * H; // f = y/s
    g.strokeStyle = 'rgba(55,65,75,0.38)'; g.lineWidth = 1.6;
    const line = (x0, f0, x1, f1, up) => { g.beginPath(); g.moveTo(U(x0, up), Vv(f0)); g.lineTo(U(x1, up), Vv(f1)); g.stroke(); };
    for (const sg of [-1, 1]) for (const up of [true, false]) {
      const fs = o.fs, fr = o.root || 0.11;
      // klaff (indre/ytre), krengeror
      line(0.75, sg * fr, 0.75, sg * fs, up); line(0.75, sg * fs, 1, sg * fs, up); line(0.75, sg * fr, 1, sg * fr, up);
      line(0.75, sg * 0.4, 1, sg * 0.4, up);
      line(0.76, sg * fs, 0.76, sg * 0.965, up); line(0.76, sg * 0.965, 1, sg * 0.965, up);
      // lameller (slats) på forkanten
      if (o.slats) { line(0.13, sg * 0.12, 0.13, sg * 0.97, up); for (const f of [0.12, 0.33, 0.52, 0.7, 0.85, 0.97]) line(0, sg * f, 0.13, sg * f, up); }
      // spoilere på oversiden
      if (up && o.spoilers !== false) { for (let i = 0; i < 5; i++) { const f0 = 0.22 + i * 0.1, f1 = f0 + 0.095; line(0.6, sg * f0, 0.6, sg * f1, true); line(0.6, sg * f0, 0.75, sg * f0, true); line(0.6, sg * f1, 0.75, sg * f1, true); } }
    }
    // tynne panellinjer langs bjelkene
    g.strokeStyle = 'rgba(55,65,75,0.12)'; g.lineWidth = 1;
    for (const x of [0.16, 0.62]) for (const up of [true, false]) { g.beginPath(); g.moveTo(U(x, up), 0); g.lineTo(U(x, up), H); g.stroke(); }
    // magenta tuppbånd mot vingetippen (diskré)
    for (const sg of [-1, 1]) { g.fillStyle = 'rgba(154,30,104,0.9)'; const y0 = Vv(sg * 0.985), y1 = Vv(sg * 1.0); g.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); }
    return tex(THREE, c, false, true);
  };

  /* ---------- haleflater (finne med magenta bånd, ror-linjer) ---------- */
  T3D.tailTex = function (THREE, o) {
    const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#eceef0'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(55,65,75,0.4)'; g.lineWidth = 1.6;
    for (const u of [0.15, 0.85]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H * 0.97); g.stroke(); }
    if (o.fin) {
      g.fillStyle = '#9a1e68';
      g.beginPath(); g.moveTo(0, H * 0.62); g.lineTo(W, H * 0.48); g.lineTo(W, H * 0.56); g.lineTo(0, H * 0.70); g.closePath(); g.fill();
    }
    return tex(THREE, c, false, true);
  };

  /* ---------- miljøkart: tunnelinteriør med lysrør, for refleksjoner i lakk og glass ---------- */
  T3D.envMap = function (THREE, renderer) {
    const es = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 20), new THREE.MeshBasicMaterial({ color: 0x40464e, side: THREE.BackSide }));
    es.add(box);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0x1c2026 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -5.9; es.add(fl);
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.8, 8.3) });
    for (const z of [-3.2, 3.2]) for (let x = -18; x < 18; x += 4) { const s = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.35), lm); s.position.set(x, 5.9, z); es.add(s); }
    const wm = new THREE.MeshBasicMaterial({ color: 0x0a0e12 });
    for (const z of [-9.9, 9.9]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wm); w.position.set(0, 0.5, z); w.lookAt(0, 0.5, 0); es.add(w); }
    const up = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.8) })); up.position.set(-19.8, 0, 0); up.rotation.y = Math.PI / 2; es.add(up);
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(es, 0.02).texture; pm.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return t;
  };

  /* ---------- testseksjonen ----------
     d: {x0,x1,y0,y1,z,ch} – rektangulært tverrsnitt med avfasede hjørner.
     Vegger mellom kamera og modell skjules (snittbilde), så modellen alltid er synlig. */
  T3D.tunnel = function (THREE, d, q) {
    const grp = new THREE.Group(), walls = [];
    const yc = 0.5 * (d.y0 + d.y1), hh = 0.5 * (d.y1 - d.y0), hw = d.z, ch = d.ch;
    // åttekant i (y,z), mot klokka sett nedstrøms
    const oct = [[-hh, hw - ch], [-hh + ch, hw], [hh - ch, hw], [hh, hw - ch], [hh, -hw + ch], [hh - ch, -hw], [-hh + ch, -hw], [-hh, -hw + ch]];
    const names = ['cfl', 'side+', 'cceil', 'ceil', 'cceil', 'side-', 'cfl', 'floor'];
    // gulvet er kanten fra punkt 7 til 0; legg det inn riktig: kant i går fra oct[i] til oct[(i+1)%8]
    const P = d.tex;
    const mats = {
      wall: new THREE.MeshStandardMaterial({ map: P.wall.map, bumpMap: P.wall.bump, bumpScale: 0.012, roughness: 0.55, metalness: 0.2, vertexColors: true }),
      floor: new THREE.MeshStandardMaterial({ map: P.floor.map, bumpMap: P.floor.bump, bumpScale: 0.012, roughness: 0.5, metalness: 0.2, vertexColors: true }),
      ceil: new THREE.MeshStandardMaterial({ map: P.ceil.map, bumpMap: P.ceil.bump, bumpScale: 0.01, roughness: 0.7, metalness: 0.1, vertexColors: true }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.5, metalness: 0.5 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x3b434c, roughness: 0.35, metalness: 0.7 }),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.35, 2.2), toneMapped: true }),
      lightFrame: new THREE.MeshStandardMaterial({ color: 0x8a939c, roughness: 0.4, metalness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0d1318, emissive: 0xffffff, emissiveMap: d.tex.room, emissiveIntensity: 0.9, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.6 })
    };
    // vegg i (y,z)-kant, ekstrudert langs x med skalering s(x) (innsnevring og diffusor)
    function wallMesh(i, xs, scales, m, uvScale) {
      const a = oct[i], b = oct[(i + 1) % 8], NX = xs.length, NP = 6;
      const pos = [], uv = [], col = [], idx = [];
      const elen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let ix = 0; ix < NX; ix++) for (let ip = 0; ip <= NP; ip++) {
        const t = ip / NP, s = scales[ix], y = yc + s * (a[0] + (b[0] - a[0]) * t), z = s * (a[1] + (b[1] - a[1]) * t);
        pos.push(xs[ix], y, z); uv.push(xs[ix] / uvScale, t * elen * s / uvScale);
        const e = Math.min(t, 1 - t) * elen, ao = 1 - 0.42 * Math.exp(-e / 0.55) - (elen < 3 ? 0.18 : 0); // hjørne-AO
        col.push(ao, ao, ao);
      }
      for (let ix = 0; ix < NX - 1; ix++) for (let ip = 0; ip < NP; ip++) {
        const p0 = ix * (NP + 1) + ip, p1 = p0 + 1, p2 = p0 + NP + 1, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const o = new THREE.Mesh(g, m); o.receiveShadow = true; return o;
    }
    // x-stasjoner: innsnevring (bikakegitter ved xh) → testseksjon → diffusor
    const xh = d.x0 - 12, xd = d.x1 + 18;
    const xs = [], sc = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = xh + (d.x0 - xh) * t; xs.push(x); const u = 1 - t; sc.push(1 + 0.75 * (u * u * (3 - 2 * u))); }
    for (let x = d.x0 + 2; x < d.x1; x += 2) { xs.push(x); sc.push(1); }
    for (let i = 0; i <= 6; i++) { const t = i / 6, x = d.x1 + (xd - d.x1) * t; xs.push(x); sc.push(1 + 0.3 * t); }
    for (let i = 0; i < 8; i++) {
      const a = oct[i], b = oct[(i + 1) % 8], n = [-(b[1] - a[1]), (b[0] - a[0])]; // innovernormal i (y,z)?
      const L = Math.hypot(n[0], n[1]); n[0] /= L; n[1] /= L;
      // sørg for at normalen peker innover (mot sentrum)
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (n[0] * mid[0] + n[1] * mid[1] > 0) { n[0] = -n[0]; n[1] = -n[1]; }
      const kind = names[i], m = kind === 'floor' ? mats.floor : kind === 'ceil' || kind === 'cceil' ? mats.ceil : mats.wall;
      const wg = new THREE.Group(); grp.add(wg);
      wg.add(wallMesh(i, xs, sc, m, kind === 'floor' ? 3 : 4));
      walls.push({ g: wg, n, p: [yc + mid[0], mid[1]] });
      if (kind === 'ceil') { // lysrør i taket
        for (const z of [-0.33 * hw, 0.33 * hw]) for (let x = d.x0 + 1; x < d.x1 - 1; x += 3.4) {
          const fr = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.42), mats.lightFrame); fr.position.set(x + 1.45, d.y1 - 0.02, z); wg.add(fr);
          const lt = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.22), mats.light); lt.position.set(x + 1.45, d.y1 - 0.05, z); wg.add(lt);
        }
      }
      if (kind === 'side+' || kind === 'side-') { // observasjonsvindu
        const sgn = kind === 'side+' ? 1 : -1, zw = sgn * (hw - 0.01), W = 9.5, H = 3.6, cx = 0.5, cy = yc + 0.3, t = 0.28;
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mats.glass); glass.position.set(cx, cy, zw + sgn * 0.004); glass.rotation.y = sgn > 0 ? Math.PI : 0; wg.add(glass);
        for (const [w, h, x, y] of [[W + 2 * t, t, cx, cy + H / 2 + t / 2], [W + 2 * t, t, cx, cy - H / 2 - t / 2], [t, H, cx - W / 2 - t / 2, cy], [t, H, cx + W / 2 + t / 2, cy], [0.12, H, cx - W / 6, cy], [0.12, H, cx + W / 6, cy]]) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), mats.frame); f.position.set(x, y, zw - sgn * 0.06); f.castShadow = false; f.receiveShadow = true; wg.add(f);
        }
      }
    }
    // bikakegitter ved enden av innsnevringen (bak: lys settling chamber)
    {
      const s = 1.75, shape = new THREE.Shape();
      oct.forEach(([y, z], i) => { i ? shape.lineTo(z * s, y * s) : shape.moveTo(z * s, y * s); });
      const g = new THREE.ShapeGeometry(shape); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2 * 1.08);
      const ht = d.tex.honey; ht.repeat.set(1, 1);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ht, color: 0xb9c3cc }));
      m.rotation.y = Math.PI / 2; m.position.set(xh + 0.02, yc, 0); grp.add(m);
      // ramme og et finmasket gitter litt nedstrøms
      const scr = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({ color: 0x9aa6b2, transparent: true, opacity: 0.07, depthWrite: false }));
      scr.rotation.y = Math.PI / 2; scr.position.set(xh + 0.9, yc, 0); scr.scale.set(0.97, 0.97, 1); grp.add(scr);
    }
    // vifte i enden av diffusoren
    {
      const s = 1.3, R = Math.min(hh, hw) * s * 0.95, fg = new THREE.Group(); fg.position.set(xd - 0.2, yc, 0);
      const back = new THREE.Mesh(new THREE.CircleGeometry(R * 1.3, 48), new THREE.MeshBasicMaterial({ color: 0x07090b })); back.rotation.y = -Math.PI / 2; back.position.x = 0.15; fg.add(back);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 24, 12), mats.dark); hub.scale.x = 1.6; fg.add(hub);
      const bladeGeo = new THREE.BoxGeometry(0.06, R * 0.78, R * 0.22); bladeGeo.translate(0, R * 0.6, 0);
      for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(bladeGeo, mats.dark); b.rotation.x = k * 2 * Math.PI / 9; b.rotation.y = 0.5; const p = new THREE.Group(); p.rotation.x = k * 2 * Math.PI / 9; const bb = new THREE.Mesh(bladeGeo, mats.dark); bb.rotation.y = 0.55; p.add(bb); fg.add(p); }
      grp.add(fg); grp.userData.fan = fg;
    }
    // dreieskive i gulvet
    {
      const r = 3.6, N = 512, c = cv(N, N), g = c.getContext('2d');
      g.fillStyle = '#3a4048'; g.fillRect(0, 0, N, N);
      const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, '#4a5058'); gr.addColorStop(0.9, '#3d434b'); gr.addColorStop(1, '#2a2f35');
      g.fillStyle = gr; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 4, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 8, 0, 7); g.stroke();
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = N / 2 + (N / 2 - 22) * Math.cos(a), y = N / 2 + (N / 2 - 22) * Math.sin(a); g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(x - 1, y - 1, 2, 0, 7); g.fill(); }
      // gradskala
      g.strokeStyle = 'rgba(230,235,240,0.45)'; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, r0 = N / 2 - 40, r1 = r0 - (k % 6 ? 6 : 14); g.lineWidth = k % 6 ? 1 : 2; g.beginPath(); g.moveTo(N / 2 + r0 * Math.cos(a), N / 2 + r0 * Math.sin(a)); g.lineTo(N / 2 + r1 * Math.cos(a), N / 2 + r1 * Math.sin(a)); g.stroke(); }
      const t = tex(THREE, c, false, true);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshStandardMaterial({ map: t, color: 0x9aa2aa, roughness: 0.55, metalness: 0.5 }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(d.tx || 0, d.y0 + 0.006, 0); disc.receiveShadow = true;
      walls[7].g.add(disc);
    }
    function update(cam) {
      for (const w of walls) { const dy = cam.y - w.p[0], dz = cam.z - w.p[1]; w.g.visible = dy * w.n[0] + dz * w.n[1] > -0.02; }
    }
    function dispose() { grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const k in mats) mats[k].dispose(); }
    return { group: grp, update, walls, dispose, mats, xh, xd };
  };

  /* ---------- GLSL: simplex-støy (Ashima Arts, MIT) ---------- */
  T3D.GLSL_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

  /* ---------- røykbånd: kamerarettede bånd langs strømlinjer ----------
     Hver linje: {p:[x,y,z,…] i scenekoordinater (overlay-ramme), tb:[] turbulensamplitude, t0: tid per punkt}
     Røyken sprer seg (bredere, svakere) nedstrøms og i turbulent kjølvann; mønsteret følger strømmen (tid langs linjen). */
  T3D.smokeMaterial = function (THREE, low) {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, w0: { value: 0.016 }, grow: { value: 2.6 }, opac: { value: 0.62 }, tint: { value: new THREE.Color(0.93, 0.95, 0.98) }, flowRate: { value: 1.0 } },
      vertexShader: T3D.GLSL_NOISE + `
        attribute vec3 prevP; attribute vec3 nextP; attribute float side; attribute float aT; attribute float aAge; attribute float aTurb; attribute float aSeed;
        uniform float time; uniform float w0; uniform float grow;
        varying float vSide; varying float vT; varying float vAge; varying float vTurb; varying float vSeed; varying float vDepth;
        vec3 turb(vec3 p, float a){
          if(a<=0.0005) return vec3(0.0);
          vec3 q=p*vec3(0.9,1.2,1.2)-vec3(0.75*time,0.0,0.0);
          float t=time*0.6;
          return a*vec3(0.55*snoise(q+vec3(0.0,0.0,t)), snoise(q+vec3(19.1,3.7,-t)), 0.8*snoise(q*1.3+vec3(-7.3,11.9,t*1.3)));
        }
        void main(){
          vec3 P=position+turb(position,aTurb), A=prevP+turb(prevP,aTurb), B=nextP+turb(nextP,aTurb);
          vec4 mv=modelViewMatrix*vec4(P,1.0);
          vec3 ta=(modelViewMatrix*vec4(B,1.0)).xyz-(modelViewMatrix*vec4(A,1.0)).xyz;
          vec3 s=cross(normalize(ta+vec3(1e-6)),normalize(mv.xyz));
          float L=length(s); s= L>1e-5 ? s/L : vec3(0.0,1.0,0.0);
          float tbn=min(aTurb/0.22,1.0); float w=w0*(1.0+grow*aAge)*(1.0+9.0*tbn);
          mv.xyz+=s*side*w;
          vSide=side; vT=aT; vAge=aAge; vTurb=aTurb; vSeed=aSeed; vDepth=-mv.z;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: (low ? '' : T3D.GLSL_NOISE) + `
        uniform float time; uniform float opac; uniform vec3 tint; uniform float flowRate;
        varying float vSide; varying float vT; varying float vAge; varying float vTurb; varying float vSeed; varying float vDepth;
        void main(){
          float across=exp(-3.2*vSide*vSide*(1.0-0.6*clamp(vTurb/0.22,0.0,1.0)));
          float ph=vT-time*flowRate;
          ${low ? 'float n=0.5+0.5*sin(ph*7.0+vSeed*40.0)*sin(ph*2.3+vSeed*13.0);' : 'float n=0.5+0.5*snoise(vec3(ph*2.2,vSeed*9.0,vTurb*3.0));'}
          float tb=clamp(vTurb/0.22,0.0,1.0);
          float puff=mix(0.78+0.22*n, pow(n,1.6)*1.25, tb);
          float fadeIn=smoothstep(0.0,0.025,vAge), fadeOut=1.0-smoothstep(0.82,1.0,vAge);
          float dens=0.55+0.45*fract(vSeed*7.31);
          float a=opac*dens*across*puff*fadeIn*fadeOut/(1.0+1.3*vAge)/(1.0+3.0*tb);
          gl_FragColor=vec4(tint*(0.9+0.1*across),a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
  };
  T3D.smokeGeometry = function (THREE, lines, stride) {
    let nv = 0, ni = 0;
    const segs = [];
    for (const L of lines) { const n = L.p.length / 3; if (n < 3) continue; const ids = []; for (let i = 0; i < n; i += stride) ids.push(i); if (ids[ids.length - 1] !== n - 1) ids.push(n - 1); segs.push([L, ids]); nv += ids.length * 2; ni += (ids.length - 1) * 6; }
    const pos = new Float32Array(nv * 3), prv = new Float32Array(nv * 3), nxt = new Float32Array(nv * 3), side = new Float32Array(nv), aT = new Float32Array(nv), aAge = new Float32Array(nv), aTurb = new Float32Array(nv), aSeed = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0, q = 0;
    for (const [L, ids] of segs) {
      const P = L.p, n = ids.length, seed = Math.random(), base = v;
      for (let k = 0; k < n; k++) {
        const i = ids[k], ia = ids[Math.max(0, k - 1)], ib = ids[Math.min(n - 1, k + 1)];
        for (const sd of [-1, 1]) {
          pos[v * 3] = P[i * 3]; pos[v * 3 + 1] = P[i * 3 + 1]; pos[v * 3 + 2] = P[i * 3 + 2];
          prv[v * 3] = P[ia * 3]; prv[v * 3 + 1] = P[ia * 3 + 1]; prv[v * 3 + 2] = P[ia * 3 + 2];
          nxt[v * 3] = P[ib * 3]; nxt[v * 3 + 1] = P[ib * 3 + 1]; nxt[v * 3 + 2] = P[ib * 3 + 2];
          side[v] = sd; aT[v] = L.t ? L.t[i] : i * L.dt; aAge[v] = k / (n - 1); aTurb[v] = L.tb ? L.tb[i] : 0; aSeed[v] = seed; v++;
        }
        if (k > 0) { const a = base + (k - 1) * 2, b = a + 1, c = a + 2, d = a + 3; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('prevP', new THREE.BufferAttribute(prv, 3)); g.setAttribute('nextP', new THREE.BufferAttribute(nxt, 3));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); g.setAttribute('aAge', new THREE.BufferAttribute(aAge, 1));
    g.setAttribute('aTurb', new THREE.BufferAttribute(aTurb, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  };

  /* ---------- rutenett-geometri med søm (for UV) og glatte normaler over sømmen ---------- */
  T3D.gridGeo = function (THREE, rows, cols, posFn, uvFn, wrap) {
    const C = wrap ? cols + 1 : cols, pos = new Float32Array(rows * C * 3), uv = new Float32Array(rows * C * 2), idx = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) {
      const jj = wrap ? j % cols : j, p = posFn(i, jj), o = i * C + j; pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2];
      const u = uvFn(i, j); uv[o * 2] = u[0]; uv[o * 2 + 1] = u[1];
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    if (wrap) { const n = g.attributes.normal; for (let i = 0; i < rows; i++) { const a = i * C, b = i * C + cols; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), L = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / L, y / L, z / L); n.setXYZ(b, x / L, y / L, z / L); } }
    return g;
  };

  root.T3D = T3D;
})(window);
