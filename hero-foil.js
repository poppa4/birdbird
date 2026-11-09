/* Birdbird front page: the live aerofoil on the navy plate in the subject areas (#ffBox).
   The Aerodynamics lab's 2D section (tunnel.html, "Aerofoil section and stall"), drawn large on the navy:
   - the panel method and the boundary-layer model are section.js (VSection.build / inviscid / viscous / polar / velAt),
     on the lab's A320-like supercritical section (physics.js VLab.AIRFOILS.sc) at the lab's default Reynolds number;
   - the pressure field is Cp = 1 − (V/V∞)² from the same potential field on a grid in the aerofoil frame, coloured with
     the lab's engineering Turbo map and Cp scale (cfd3d.js CFD.cmap / CFD.cpMid), with iso-lines every 0.25;
   - the separated region, its pressure plateau, the streamlines and the wake smoke are the lab's own construction
     (ported from tunnel.html SEC: deadGeo, dzAt, cpGrid, traceLines, step), so the picture and the numbers are the lab's.
   It rests at α = 13° and breathes ±0.8° around it while the smoke flows; the lab's teaching annotations are drawn on
   it (stagnation point, relative wind, α, suction above, high pressure below, transition, separation, lift at the
   centre of pressure), each on a dark halo and kept apart. Far from the aerofoil the field fades into the navy plate, where
   it is free stream (Cp = 0) anyway. The canvas fills the plate; the section is laid out in the plate's .ff-frame (the
   area clear of the readout and the colour bar), or in the plate itself if there is none.
   Loaded by index.html when the plate comes near the screen; paused off screen; reduced motion: one still at 13°. */
(function () {
  'use strict';
  const box = document.getElementById('ffBox'), cv = document.getElementById('ffCv');
  if (!box || !cv || window.__heroFoil) return;
  const fbox = box.querySelector('.ff-frame') || box;
  window.__heroFoil = {};
  const DEG = Math.PI / 180;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOW = innerWidth < 700 || (navigator.hardwareConcurrency || 4) <= 4;
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const idle = f => (window.requestIdleCallback || (g => setTimeout(g, 16)))(f, { timeout: 120 });

  let V, CFD, g, inv, vis, pol, GF = null, DZ2 = null, DW = null;
  const A0 = 13;   // resting angle of attack: trailing-edge separation has just begun, the suction peak is strong
  const ps = { alpha: A0, logRe: Math.log10(3.0e7) };
  const CMAP = 1;   // Turbo, the lab's engineering default
  const GD = LOW ? 0.022 : 0.019, AX0 = -0.95, AX1 = 2.25, AY0 = -1.42, AY1 = 1.42;
  let W = 0, H = 0, dpr = 1, K = 1, OX = 0, OY = 0, XR = [0, 1], YR = [0, 1], BX0 = 0, BX1 = 1;
  const ctx = cv.getContext('2d');

  /* ---------- geometry helpers (as in tunnel.html SEC) ---------- */
  const rotD = (x, y) => { const a = -ps.alpha * DEG, c = Math.cos(a), s = Math.sin(a), dx = x - 0.25; return [0.25 + dx * c - y * s, dx * s + y * c]; };
  const rotA = (x, y) => { const a = ps.alpha * DEG, c = Math.cos(a), s = Math.sin(a), dx = x - 0.25; return [0.25 + dx * c - y * s, dx * s + y * c]; };
  const sx = x => OX + x * K, sy = y => OY - y * K;
  const TP = (ax, ay) => { const [x, y] = rotD(ax, ay); return [sx(x), sy(y)]; };
  function inside(ax, ay) {
    if (ax < g.xmin - 0.01 || ax > g.xmax + 0.01) return false;
    let c = false; const X = g.X, Y = g.Y, n = X.length - 1;
    for (let i = 0, j = n - 1; i < n; j = i++) { if (((Y[i] > ay) !== (Y[j] > ay)) && (ax < (X[j] - X[i]) * (ay - Y[i]) / (Y[j] - Y[i]) + X[i])) c = !c; }
    return c;
  }
  function upperY(x) { const X = g.X, Y = g.Y, n = X.length; for (let i = Math.floor(n / 2); i < n - 1; i++) { if (X[i + 1] >= x) { const t = (x - X[i]) / Math.max(1e-9, X[i + 1] - X[i]); return Y[i] + t * (Y[i + 1] - Y[i]); } } return Y[n - 1]; }
  function lowerY(x) { const X = g.X, Y = g.Y, n = Math.floor(X.length / 2); for (let i = n; i > 0; i--) { if (X[i - 1] >= x) { const t = (x - X[i]) / Math.max(1e-9, X[i - 1] - X[i]); return Y[i] + t * (Y[i - 1] - Y[i]); } } return Y[0]; }
  function sepInfo() { const upSide = inv.CL >= 0, b = upSide ? vis.up : vis.lo; if (b.xsep == null || b.xsep >= 0.98) return null; return { x0: b.xsep, up: upSide, h: 0.03 + 0.5 * (1 - vis.f) }; }

  /* ---------- the velocity grid: Hess–Smith is linear in (cos α, sin α), so two solutions (0° and 90°) cover every α.
     Same superposition as tunnel.html precompute(), via section.js velAt; done in slices so no task blocks the page. */
  function precompute(done) {
    const nx = Math.round((AX1 - AX0) / GD) + 1, ny = Math.round((AY1 - AY0) / GD) + 1, n = nx * ny;
    const s0 = V.inviscid(g, 0), s9 = V.inviscid(g, 90);
    const U0 = new Float32Array(n), V0 = new Float32Array(n), U9 = new Float32Array(n), V9 = new Float32Array(n), M = new Uint8Array(n);
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9; for (let i = 0; i < g.X.length; i++) { bx0 = Math.min(bx0, g.X[i]); bx1 = Math.max(bx1, g.X[i]); by0 = Math.min(by0, g.Y[i]); by1 = Math.max(by1, g.Y[i]); }
    let j = 0;
    const slice = () => {
      const t0 = performance.now();
      for (; j < ny && performance.now() - t0 < 12; j++) { const y = AY0 + j * GD; for (let i = 0; i < nx; i++) { const x = AX0 + i * GD, k = j * nx + i;
        if (x > bx0 - 0.01 && x < bx1 + 0.01 && y > by0 - 0.01 && y < by1 + 0.01 && inside(x, y)) { M[k] = 1; continue; }
        const a = V.velAt(g, s0, x, y, 1, 0), b = V.velAt(g, s9, x, y, 0, 1); U0[k] = a[0]; V0[k] = a[1]; U9[k] = b[0]; V9[k] = b[1]; } }
      if (j < ny) { setTimeout(slice, 0); return; }
      for (let it = 0; it < 3; it++) { const fill = []; for (let k = 0; k < n; k++) { if (M[k] !== 1) continue; const su = [0, 0, 0, 0]; let c = 0;
        for (const d of [-1, 1, -nx, nx]) { const q = k + d; if (q < 0 || q >= n || M[q] === 1) continue; su[0] += U0[q]; su[1] += V0[q]; su[2] += U9[q]; su[3] += V9[q]; c++; }
        if (c) fill.push([k, su[0] / c, su[1] / c, su[2] / c, su[3] / c]); }
        for (const [k, a, b, c2, d] of fill) { U0[k] = a; V0[k] = b; U9[k] = c2; V9[k] = d; M[k] = 2; } }
      GF = { nx, ny, U0, V0, U9, V9, M, bx0, bx1, by0, by1, U: new Float32Array(n), V: new Float32Array(n) };
      done();
    };
    slice();
  }
  function blend() { const ca = Math.cos(ps.alpha * DEG), sa = Math.sin(ps.alpha * DEG), F = GF; for (let k = 0; k < F.U.length; k++) { F.U[k] = ca * F.U0[k] + sa * F.U9[k]; F.V[k] = ca * F.V0[k] + sa * F.V9[k]; } }
  const VA = [0, 0];
  function velA(x, y) {
    const F = GF, fx = (x - AX0) / GD, fy = (y - AY0) / GD, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= F.nx - 1 || j >= F.ny - 1) { VA[0] = Math.cos(ps.alpha * DEG); VA[1] = Math.sin(ps.alpha * DEG); return VA; }
    const tx = fx - i, ty = fy - j, k = j * F.nx + i, U = F.U, Vv = F.V, nx = F.nx;
    VA[0] = (U[k] * (1 - tx) + U[k + 1] * tx) * (1 - ty) + (U[k + nx] * (1 - tx) + U[k + nx + 1] * tx) * ty;
    VA[1] = (Vv[k] * (1 - tx) + Vv[k + 1] * tx) * (1 - ty) + (Vv[k + nx] * (1 - tx) + Vv[k + nx + 1] * tx) * ty; return VA;
  }
  function inBody(x, y) { const F = GF; return x > F.bx0 - 0.005 && x < F.bx1 + 0.005 && y > F.by0 - 0.005 && y < F.by1 + 0.005 && inside(x, y); }
  function pushOut(x, y) { let best = 1e9, bi = 0; for (let i = 0; i < g.N; i++) { const d = (g.xc[i] - x) ** 2 + (g.yc[i] - y) ** 2; if (d < best) { best = d; bi = i; } } return [g.xc[bi] - g.sn[bi] * 0.004, g.yc[bi] + g.cs[bi] * 0.004]; }

  /* ---------- separated region (display frame, wind horizontal): tunnel.html deadGeo / dzAt ---------- */
  function deadGeo() {
    DZ2 = null; const si = sepInfo(); if (!si) return;
    const up = si.up, xs = si.x0, S = rotD(xs, up ? upperY(xs) : lowerY(xs)), TE = rotD(g.X[0], g.Y[0]), sgn = up ? 1 : -1;
    const pts = [], n = g.X.length, NH2 = (n - 1) / 2;
    if (up) { for (let i = NH2; i < n; i++) if (g.X[i] >= xs) pts.push(rotD(g.X[i], g.Y[i])); }
    else { for (let i = NH2; i >= 0; i--) if (g.X[i] >= xs) pts.push(rotD(g.X[i], g.Y[i])); }
    pts.sort((a, b) => a[0] - b[0]);
    DZ2 = { S, TE, sgn, xs, pts, Lw: 0.8 + 2.4 * (1 - xs), sev: Math.min(1, (1 - xs) * 2.2), h: Math.abs(S[1] - TE[1]) + 0.02 };
  }
  function surfAt(x) { const p = DZ2.pts; if (!p.length) return DZ2.TE[1]; if (x <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (p[i][0] >= x) { const t = (x - p[i - 1][0]) / Math.max(1e-9, p[i][0] - p[i - 1][0]); return p[i - 1][1] + t * (p[i][1] - p[i - 1][1]); } return p[p.length - 1][1]; }
  const DZR = { edge: 0, surf: 0, ff: 0 };
  function dzAt(x) { const D = DZ2, dx = x - D.S[0]; if (dx < 0) return null;
    const sh = D.S[1] + D.sgn * dx * 0.05; let surf, ff = 0;
    if (x <= D.TE[0]) surf = surfAt(x); else { surf = D.TE[1] - D.sgn * (x - D.TE[0]) * 0.05; ff = Math.min(1, (x - D.TE[0]) / D.Lw); }
    DZR.edge = sh - (sh - surf) * ff * ff; DZR.surf = surf; DZR.ff = ff; return DZR; }
  function inDead(x, y) { if (!DZ2) return false; const r = dzAt(x); if (!r || r.ff >= 1) return false; return (y - r.surf) * DZ2.sgn > 0 && (r.edge - y) * DZ2.sgn > 0; }

  /* ---------- the solution at the current α ---------- */
  function solve() { inv = V.inviscid(g, ps.alpha); vis = V.viscous(g, inv, Math.pow(10, ps.logRe), 0); }

  /* Cp per grid node (aerofoil frame); in the separated region the lab's pressure plateau */
  function cpGrid() {
    const F = GF, n = F.U.length, cp = new Float32Array(n); let plateau = -0.5; if (!DW || DW.length !== n) DW = new Float32Array(n); DW.fill(0);
    if (DZ2) { const si = sepInfo(); let best = 1e9, bi = 0; const half = g.N / 2; for (let i = 0; i < g.N; i++) { if ((i >= half) !== si.up) continue; const d = Math.abs(g.xc[i] - si.x0); if (d < best) { best = d; bi = i; } }
      plateau = Math.max(-1.2, Math.min(-0.2, inv.Cp[bi] * 0.8)); }
    for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) { const k = j * F.nx + i; if (F.M[k] === 1) { cp[k] = NaN; continue; }
      let c = 1 - (F.U[k] * F.U[k] + F.V[k] * F.V[k]);
      if (DZ2) { const [dx, dy] = rotD(AX0 + i * GD, AY0 + j * GD), r = dzAt(dx);
        if (r && r.ff < 1) { const d = Math.min((dy - r.surf) * DZ2.sgn, (r.edge - dy) * DZ2.sgn), w = Math.max(0, Math.min(1, 0.5 + d / 0.05)) * (1 - r.ff * r.ff); c = c + (plateau - c) * w; DW[k] = w; } }
      cp[k] = c; }
    return cp;
  }
  // colour position: the lab's fixed Cp scale −3…+1, split at Cp = 0 (free stream) = CFD.cpMid on the Turbo map
  const fieldT = v => { const m = CFD.cpMid(CMAP); return Math.max(0, Math.min(1, v < 0 ? m + m * v / 3 : m + (1 - m) * v)); };

  /* streamlines from the left edge, RK2 through the grid; in the separated region they ride its edge (tunnel.html traceLines) */
  let SL2 = []; const DT2 = 0.009, PUL = 0.105;
  function traceLines() {
    SL2 = []; const NL = Math.round(Math.max(18, Math.min(40, H / (LOW ? 17 : 15))));
    for (let l = 0; l < NL; l++) {
      const yd = YR[0] + 0.03 + (YR[1] - YR[0] - 0.06) * (l + 0.5) / NL; let [ax, ay] = rotA(XR[0] + 0.005, yd);
      const xs = [], ys = []; let turb = -1;
      for (let n = 0; n < 1400; n++) {
        const [dx0, dy0] = rotD(ax, ay); xs.push(dx0); ys.push(dy0);
        if (dx0 > XR[1] + 0.03 || dy0 < YR[0] - 0.06 || dy0 > YR[1] + 0.06) break;
        let v = velA(ax, ay); const u1 = v[0], v1 = v[1]; v = velA(ax + u1 * DT2 / 2, ay + v1 * DT2 / 2);
        let nx = ax + v[0] * DT2, ny = ay + v[1] * DT2;
        if (inBody(nx, ny)) [nx, ny] = pushOut(nx, ny);
        if (DZ2) { let [dx, dy] = rotD(nx, ny);
          if (inDead(dx, dy)) { const r = dzAt(dx); const toEdge = Math.abs(r.edge - dy) <= Math.abs(dy - r.surf) || dx <= DZ2.TE[0];
            dy = toEdge ? r.edge + DZ2.sgn * 0.003 : r.surf - DZ2.sgn * 0.003; [nx, ny] = rotA(dx, dy); if (turb < 0) turb = xs.length; }
          else if (turb < 0) { const r = dzAt(dx); if (r && r.ff < 1 && Math.abs(dy - r.edge) < 0.006 + 0.03 * (dx - DZ2.S[0])) turb = xs.length; } }
        ax = nx; ay = ny;
      }
      SL2.push({ x: Float32Array.from(xs), y: Float32Array.from(ys), n: xs.length, turb });
    }
  }

  /* ---------- layers: field (offscreen, rebuilt when α moves), animated smoke, aerofoil on top ---------- */
  const baseC = document.createElement('canvas'), bctx = baseC.getContext('2d');
  const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
  let img = null, MASK = null;
  function fieldMask() { // fade far from the aerofoil (where Cp → 0, free stream) so the field dissolves into the page
    const F = GF; MASK = new Float32Array(F.nx * F.ny);
    for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) { const x = AX0 + i * GD, y = AY0 + j * GD, r = Math.hypot((x - 0.45) / 1.08, y / 0.66), t = Math.max(0, Math.min(1, (r - 0.42) / 0.55)); MASK[j * F.nx + i] = 1 - t * t * (3 - 2 * t); }
  }
  function buildBase() {
    const F = GF, c = bctx;
    if (baseC.width !== Math.round(W * dpr) || baseC.height !== Math.round(H * dpr)) { baseC.width = Math.round(W * dpr); baseC.height = Math.round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // a navy pool under the field (the plate's own navy), so whatever is behind gives way around the aerofoil
    c.save(); c.translate(sx(0.5), sy(0)); c.scale(1.7, 1); const pool = c.createRadialGradient(0, 0, 0, 0, 0, K * 1.15);
    pool.addColorStop(0, 'rgba(11,37,69,.97)'); pool.addColorStop(0.62, 'rgba(11,37,69,.88)'); pool.addColorStop(1, 'rgba(11,37,69,0)');
    c.fillStyle = pool; c.fillRect(-K * 2, -K * 2, K * 4, K * 4); c.restore();
    const q = cpGrid();
    if (!img || img.width !== F.nx) { img = new ImageData(F.nx, F.ny); tmp.width = F.nx; tmp.height = F.ny; }
    const d = img.data;
    for (let k = 0; k < q.length; k++) { const o = k * 4; if (!Number.isFinite(q[k])) { d[o + 3] = 0; continue; }
      const col = CFD.cmap(CMAP, fieldT(q[k])); d[o] = col[0] * 255; d[o + 1] = col[1] * 255; d[o + 2] = col[2] * 255; d[o + 3] = 255 * MASK[k]; }
    tctx.putImageData(img, 0, 0);
    c.save(); c.translate(sx(0.25), sy(0)); c.scale(K, -K); c.rotate(-ps.alpha * DEG); c.translate(-0.25, 0);
    c.imageSmoothingEnabled = true; c.globalAlpha = 0.88; c.drawImage(tmp, AX0 - GD / 2, AY0 - GD / 2, F.nx * GD, F.ny * GD); c.globalAlpha = 1;
    // iso-lines (marching squares) every 0.25 in Cp, stronger on whole numbers; faded with the field
    const nx = F.nx, lv = []; for (let v = -3; v <= 1 + 1e-6; v += 0.25) { const qq = +v.toFixed(2); if (Math.abs(qq) > 1e-6) lv.push(qq); }
    for (const major of [false, true]) {
      c.lineWidth = (major ? 1.25 : 0.7) / K; c.strokeStyle = major ? 'rgba(6,12,24,0.5)' : 'rgba(6,12,24,0.26)'; c.beginPath();
      for (let j = 0; j < F.ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i; if (MASK[k] < 0.08) continue;
        const a = q[k], b = q[k + 1], e1 = q[k + nx], e = q[k + nx + 1]; if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(e1) && Number.isFinite(e))) continue;
        const mn = Math.min(a, b, e1, e), mx = Math.max(a, b, e1, e); if (mx - mn < 1e-4) continue;
        const x0 = AX0 + i * GD, y0 = AY0 + j * GD;
        for (const L of lv) { if (L < mn || L > mx) continue; const isM = Math.abs(L - Math.round(L)) < 1e-6; if (isM !== major) continue; const p = [];
          const ed = (v1, v2, X1, Y1, X2, Y2) => { if ((v1 - L) * (v2 - L) < 0) { const t = (L - v1) / (v2 - v1); p.push(X1 + (X2 - X1) * t, Y1 + (Y2 - Y1) * t); } };
          ed(a, b, x0, y0, x0 + GD, y0); ed(b, e, x0 + GD, y0, x0 + GD, y0 + GD); ed(e, e1, x0 + GD, y0 + GD, x0, y0 + GD); ed(e1, a, x0, y0 + GD, x0, y0);
          if (p.length >= 4) { c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); } if (p.length === 8) { c.moveTo(p[4], p[5]); c.lineTo(p[6], p[7]); } } }
      c.stroke(); }
    c.restore();
    // smoke lines: a soft glow and a thin core, thinning downstream (as in the lab)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const pass of [[5, 0.025], [2.4, 0.055], [1, 0.32]]) {
      c.lineWidth = pass[0];
      for (const L of SL2) { const end = L.turb >= 0 ? Math.min(L.n, L.turb + 14) : L.n;
        for (let a = 0; a < end - 1; a += 10) { const b = Math.min(end - 1, a + 10), age = a / Math.max(1, L.n), fade = L.turb >= 0 && a > L.turb ? Math.max(0, 1 - (a - L.turb) / 14) : 1;
          const al = pass[1] * (1 - 0.45 * age) * fade * Math.min(1, a / 6 + 0.3); if (al <= 0.003) continue;
          c.strokeStyle = `rgba(236,242,248,${al})`; c.beginPath(); c.moveTo(sx(L.x[a]), sy(L.y[a])); for (let i = a + 1; i <= b; i++) c.lineTo(sx(L.x[i]), sy(L.y[i])); c.stroke(); } } }
  }

  /* wake smoke: particles rolled up by vortices shed alternately from the shear layer and the trailing edge (tunnel.html step) */
  const NW = LOW ? 200 : 420, wx = new Float32Array(NW), wy = new Float32Array(NW), wa = new Float32Array(NW).fill(1e9), wl = new Float32Array(NW), wz = new Float32Array(NW);
  let vtx = [], shedT = 0, shedSide = 1, simT = 0;
  function spawnW(i) {
    if (DZ2) { const D = DZ2, u = Math.random(); const x = D.S[0] + u * (D.TE[0] - D.S[0] + 0.3); const r = dzAt(x) || { edge: D.S[1], surf: D.S[1] };
      wx[i] = x; wy[i] = r.edge - D.sgn * Math.random() * Math.abs(r.edge - r.surf) * 0.95; }
    else { const TE = rotD(g.X[0], g.Y[0]); wx[i] = TE[0] + Math.random() * 0.03; wy[i] = TE[1] + (Math.random() - 0.5) * 0.012; }
    wa[i] = 0; wl[i] = 1.2 + Math.random() * 1.8; wz[i] = Math.random();
  }
  function step(dt) {
    const dts = dt * 0.55; simT += dts;
    if (DZ2) { const D = DZ2, period = Math.max(0.12, D.h / 0.2);
      shedT += dts; if (shedT > period / 2 && vtx.length < 10) { shedT = 0; shedSide = -shedSide;
        const x = D.TE[0] + 0.03, r = dzAt(x), y = shedSide > 0 ? r.edge : D.TE[1];
        vtx.push({ x, y, G: -D.sgn * shedSide * 0.65 * D.h * D.sev, rc: 0.03 + 0.15 * D.h }); }
      for (const v of vtx) { v.x += 0.55 * dts; const r = dzAt(v.x); if (r) { const mid = (r.edge + r.surf) / 2; v.y += (mid - v.y) * 0.3 * dts; } v.rc += 0.04 * dts; }
      vtx = vtx.filter(v => v.x < XR[1] + 0.5);
    } else vtx.length = 0;
    const active = DZ2 ? NW : Math.min(NW, 60);
    for (let i = 0; i < NW; i++) {
      if (i >= active) { wa[i] = 1e9; continue; }
      if (wa[i] > wl[i]) { spawnW(i); continue; }
      let u, v; const r = DZ2 ? dzAt(wx[i]) : null;
      const inW = r && (wy[i] - r.surf) * DZ2.sgn > -0.04 && (r.edge - wy[i]) * DZ2.sgn > -0.03 - 0.05 * Math.max(0, wx[i] - DZ2.S[0]);
      if (inW) { const f = Math.max(0, Math.min(1, (wy[i] - r.surf) / ((r.edge - r.surf) || 1e-3))); u = 0.2 + 0.55 * f; v = 0; }
      else { const [ax, ay] = rotA(wx[i], wy[i]); const q = velA(ax, ay), c = Math.cos(-ps.alpha * DEG), s = Math.sin(-ps.alpha * DEG); u = q[0] * c - q[1] * s; v = q[0] * s + q[1] * c; }
      for (const vv of vtx) { const dx = wx[i] - vv.x, dy = wy[i] - vv.y, r2 = dx * dx + dy * dy + vv.rc * vv.rc, f = vv.G / (2 * Math.PI * r2); u += -f * dy; v += f * dx; }
      const turb = DZ2 ? 0.35 * DZ2.sev : 0.05; u += (Math.random() - 0.5) * turb; v += (Math.random() - 0.5) * turb;
      wx[i] += u * dts; wy[i] += v * dts; wa[i] += dts;
      if (wx[i] > XR[1] + 0.05 || wy[i] < YR[0] || wy[i] > YR[1]) { spawnW(i); continue; }
      const [bx, by] = rotA(wx[i], wy[i]); if (inBody(bx, by)) spawnW(i);
    }
  }
  const spr = (function () { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'), r = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(236,241,246,1)'); r.addColorStop(0.45, 'rgba(236,241,246,.42)'); r.addColorStop(1, 'rgba(236,241,246,0)'); q.fillStyle = r; q.fillRect(0, 0, 64, 64); return c; })();

  function drawFoil() {
    // the section: a lacquered model, lit from above
    const P0 = TP(0.3, 0), gr = ctx.createLinearGradient(P0[0], P0[1] - K * 0.09, P0[0], P0[1] + K * 0.09);
    gr.addColorStop(0, '#E4E9EE'); gr.addColorStop(0.5, '#9AA6B2'); gr.addColorStop(1, '#4A5662');
    ctx.beginPath(); for (let i = 0; i < g.X.length; i++) { const p = TP(g.X[i], g.Y[i]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.closePath(); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = 'rgba(245,248,251,.85)'; ctx.lineWidth = 1; ctx.stroke();
    const b0 = inv.CL >= 0 ? vis.up : vis.lo, sepOn = b0.xsep != null && b0.xsep < 0.98;
    // chord line, and the relative wind arriving horizontally: α is the angle between them
    const L0 = TP(0, 0), R = K * 0.27, a = ps.alpha * DEG;
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); let p = TP(-0.02, 0); ctx.moveTo(p[0], p[1]); p = TP(1.04, 0); ctx.lineTo(p[0], p[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L0[0], L0[1]); ctx.lineTo(L0[0] - R * 1.12 * Math.cos(a), L0[1] - R * 1.12 * Math.sin(a)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(L0[0], L0[1]); ctx.lineTo(L0[0] - R * 1.12, L0[1]); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(L0[0], L0[1], R * 0.8, Math.PI, Math.PI + a, a < 0); ctx.stroke();
    const am = [L0[0] - R * 0.8 * Math.cos(a / 2), L0[1] - R * 0.8 * Math.sin(a / 2)];
    // relative wind arrow, upstream and below the chord line
    const wy = sy(0) + K * 0.2, wx0 = sx(-0.4), wx1 = sx(-0.12);
    arrow(wx0, wy, wx1, wy, '#fff', 1.8);
    // lift: perpendicular to the relative wind, at the centre of pressure, length with CL (the lab's green arrow)
    const c0 = TP(vis.cp, 0), Ll = Math.max(0, Math.min(2.4, vis.CL)) * K * 0.2;
    arrow(c0[0], c0[1], c0[0], c0[1] - Ll, '#6FE0A0', 2.4);
    ctx.fillStyle = '#6FE0A0'; ctx.beginPath(); ctx.arc(c0[0], c0[1], 3.6, 0, Math.PI * 2); ctx.fill();
    // stagnation point
    const st0 = TP(vis.stag.x, vis.stag.y); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st0[0], st0[1], 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(8,20,38,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    // transition (amber diamond) on the suction side, separation (red cross)
    const dia = q => { ctx.fillStyle = '#F0B440'; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 5); ctx.lineTo(q[0] + 5, q[1]); ctx.lineTo(q[0], q[1] + 5); ctx.lineTo(q[0] - 5, q[1]); ctx.closePath(); ctx.fill(); };
    let trq = null; if (vis.up.xtr != null && vis.up.xtr < 0.98) { trq = TP(vis.up.xtr, upperY(vis.up.xtr)); dia(trq); }
    let sq = null; if (sepOn) { sq = TP(b0.xsep, inv.CL >= 0 ? upperY(b0.xsep) : lowerY(b0.xsep));
      ctx.strokeStyle = '#FF6B57'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sq[0] - 5, sq[1] - 5); ctx.lineTo(sq[0] + 5, sq[1] + 5); ctx.moveTo(sq[0] + 5, sq[1] - 5); ctx.lineTo(sq[0] - 5, sq[1] + 5); ctx.stroke(); }
    // labels: anchor, preferred offset, colour; placed in order and nudged apart so none overlap
    const su = TP(0.3, upperY(0.3)), lo = TP(0.42, lowerY(0.42)), sm = K < 300;
    const LB = [
      [T('Relative wind', 'Relativ vind'), wx0, wy + 16, '#fff', 'left'],
      ['α ' + nf(ps.alpha, 1) + '°', am[0] - 10, am[1], '#fff', 'right'],
      [T('Stagnation point', 'Stagnasjonspunkt'), st0[0] - 12, st0[1] + 22, '#fff', 'right'],
      [T('Suction: low pressure', 'Sug: lavt trykk'), su[0] - K * 0.02, su[1] - K * (sm ? 0.2 : 0.17), '#CFE4FF', 'center'],
      [T('High pressure', 'Høyt trykk'), lo[0], lo[1] + K * 0.16, '#FFE1C2', 'center'],
      [T('Lift', 'Løft') + ' · CL ' + nf(vis.CL, 2), c0[0] + 10, c0[1] - Ll * 0.62, '#9FF0C2', 'left']];
    if (trq) LB.push([T('Transition', 'Omslag'), trq[0] + 4, trq[1] - 30, '#FFD58A', 'left']);
    if (sq) LB.push([T('Separation', 'Separasjon') + ' ' + nf(Math.round(b0.xsep * 100), 0) + ' %', sq[0], sq[1] - 30, '#FFB3A6', 'center']);
    ctx.font = `600 ${sm ? 11.5 : 12.5}px "Public Sans", system-ui, sans-serif`; ctx.textBaseline = 'middle';
    const boxes = [];
    for (const [t, x, y0, col, al] of LB) {
      const w = ctx.measureText(t).width, x0 = Math.max(Math.max(BX0 - K * 0.15, 8), Math.min(BX1 - w - 4, al === 'right' ? x - w : al === 'center' ? x - w / 2 : x)); let y = y0;
      for (let it = 0; it < 12; it++) { const hit = boxes.find(q => x0 < q[0] + q[2] + 6 && x0 + w + 6 > q[0] && Math.abs(y - q[1]) < 17); if (!hit) break; y = y <= hit[1] ? hit[1] - 18 : hit[1] + 18; }
      boxes.push([x0, y, w]);
      ctx.lineJoin = 'round'; ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(7,18,34,.88)'; ctx.textAlign = 'left'; ctx.strokeText(t, x0, y);
      ctx.fillStyle = col; ctx.fillText(t, x0, y);
    }
  }
  function arrow(x0, y0, x1, y1, col, w) { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w || 1.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0), hl = Math.min(9, Math.hypot(x1 - x0, y1 - y0) * 0.45); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(a - 0.45), y1 - hl * Math.sin(a - 0.45)); ctx.lineTo(x1 - hl * Math.cos(a + 0.45), y1 - hl * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.drawImage(baseC, 0, 0, W, H);
    // pulsing smoke: bright time-lines that travel with the flow (their spacing shows the speed)
    const ph = simT % PUL; ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(250,252,255,.3)'; ctx.beginPath();
    for (const L of SL2) { const end = L.turb >= 0 ? L.turb : L.n, T0 = end * DT2;
      for (let tk = ph; tk < T0; tk += PUL) { const i0 = Math.floor(tk / DT2), i1 = Math.min(end - 1, i0 + Math.max(2, Math.round(PUL * 0.3 / DT2))); if (i1 <= i0) continue;
        ctx.moveTo(sx(L.x[i0]), sy(L.y[i0])); for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(sx(L.x[i]), sy(L.y[i])); } }
    ctx.stroke();
    for (let i = 0; i < NW; i++) { if (wa[i] > wl[i]) continue; const a = wa[i] / wl[i];
      const s = (0.018 + 0.07 * Math.min(1, wa[i] * 1.2)) * K * (DZ2 ? 1 : 0.4) * (0.7 + 0.6 * wz[i]);
      ctx.globalAlpha = (DZ2 ? 0.12 : 0.1) * Math.min(1, wa[i] * 8) * (1 - a); ctx.drawImage(spr, sx(wx[i]) - s, sy(wy[i]) - s, 2 * s, 2 * s); }
    ctx.globalAlpha = 1;
    drawFoil();
  }

  /* ---------- readout (DOM, so it is crisp and bilingual) ---------- */
  const ro = document.getElementById('ffRo'), stEl = document.getElementById('ffSt');
  const T = (en, no) => (window.LAB && LAB.lang === 'no') ? no : en;
  const nf = (v, d) => (window.LAB && LAB.nf) ? LAB.nf(v, d) : v.toFixed(d);
  let roKey = '';
  function readout() {
    const b = inv.CL >= 0 ? vis.up : vis.lo, sep = b.xsep != null && b.xsep < 0.98, past = ps.alpha > pol.alphaCrit;
    const key = ps.alpha.toFixed(1) + '|' + vis.CL.toFixed(2) + '|' + (sep ? Math.round(b.xsep * 100) : -1) + '|' + (window.LAB && LAB.lang);
    if (key === roKey) return; roKey = key;
    ro.innerHTML = `<div><dt>α</dt><dd>${nf(ps.alpha, 1)}°</dd></div><div><dt>CL</dt><dd>${nf(vis.CL, 2)}</dd></div><div><dt>${T('SEP.', 'SEP.')}</dt><dd>${sep ? nf(Math.round(b.xsep * 100), 0) + ' %' : T('none', 'ingen')}</dd></div>`;
    const cls = past ? 'stall' : sep ? 'warn' : 'ok';
    stEl.className = 'ff-st ' + cls;
    stEl.textContent = past ? T('Past the critical angle: stall', 'Forbi kritisk vinkel: stall') : sep ? T('Trailing-edge separation', 'Bakkantseparasjon') : T('Attached flow', 'Festet strømning');
  }

  /* ---------- layout ---------- */
  function layout() {
    const r = cv.getBoundingClientRect(), b = fbox.getBoundingClientRect(); if (!r.width || !b.width) return false;
    dpr = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    BX0 = b.left - r.left; BX1 = b.right - r.left;
    const narrow = b.width < 520; K = b.width * (narrow ? 0.62 : (+fbox.dataset.k || 0.72));   // data-k: chord as a share of the frame
    OX = (b.left - r.left) + b.width * 0.5 - K * (narrow ? 0.3 : 0.36); OY = (b.top - r.top) + b.height * 0.52;
    XR = [(0 - OX) / K, (W - OX) / K]; YR = [(OY - H) / K, OY / K];
    return true;
  }

  /* ---------- α: rests at 13° and breathes slowly around it ---------- */
  let built = -99, lastB = 0, clock = 0;
  function rebuild(force) {
    const now = performance.now();
    if (!force && (Math.abs(ps.alpha - built) < 0.04 || now - lastB < (LOW ? 140 : 75))) return;
    lastB = now; built = ps.alpha; solve(); blend(); deadGeo(); traceLines(); buildBase(); readout();
  }
  let vis0 = false, raf = 0, last = 0;
  function frame(ts) {
    raf = 0; if (!vis0 || document.hidden) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, ((ts || 0) - last) / 1000) || 0.016; last = ts || 0; clock += dt;
    ps.alpha = A0 + 0.8 * Math.sin(clock * 2 * Math.PI / 16);
    rebuild(false); step(dt); draw();
  }
  function go() { if (!raf && vis0 && !RM) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  async function start() {
    try {
      if (!window.VSection) await load('section.js?v=11');
      if (!window.VLab) await load('physics.js?v=12');
      if (!window.CFD) await load('cfd3d.js?v=6');
    } catch (e) { return; }
    V = window.VSection; CFD = window.CFD;
    g = V.build(window.VLab.AIRFOILS.sc, 0);
    let x0 = 1e9, x1 = -1e9; for (const x of g.X) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } g.xmin = x0; g.xmax = x1;
    pol = V.polar(g, Math.pow(10, ps.logRe), 0, -6, 24, 0.5);
    if (!layout()) return;
    precompute(() => {
      fieldMask(); rebuild(true);
      if (RM) { for (let i = 0; i < 120; i++) step(1 / 60); }
      const cb = box.querySelector('.ff-cbar .bar'); if (cb) cb.style.background = CFD.cssGrad(CMAP, 'to right', 24);
      draw(); box.classList.add('live');
      window.__heroFoil.ready = true;
      new ResizeObserver(() => { if (layout()) { traceLines(); buildBase(); draw(); } }).observe(cv);
      if (window.LAB && LAB.onLang) LAB.onLang(() => { roKey = ''; readout(); });
      new IntersectionObserver(es => { vis0 = es[0].isIntersecting; go(); }).observe(cv);
      document.addEventListener('visibilitychange', go);
    });
  }
  window.__heroFoil.set = a => { ps.alpha = a; vis0 = false; rebuild(true); draw(); };   // for checks: freeze at α
  start();
})();
