/* Birdbird – stab.js: A320 stability, control and load-factor model for stability.html.
   Illustrative training values for an A320-size aircraft, not AFM / FCOM data.
   Closed-form trim and gust equations, linear small-perturbation dynamics (RK4),
   eigenvalues from the characteristic polynomial. Plus a small canvas 3D polygon renderer
   and dark-instrument chart helpers. Works in the browser (window.STAB) and in Node (module.exports). */
(function (root) {
  'use strict';
  const g = 9.80665, R0 = 1.225, KT = 0.514444, FT = 0.3048, D2R = Math.PI / 180, A0KT = 661.47;

  /* ---------------- aircraft ---------------- */
  const AC = {
    S: 122.6, c: 4.19, b: 34.1,            // wing area m², MAC m, span m
    mtow: 78, mlw: 66, mmin: 40,           // t
    hac: 0.11,                             // wing-body aerodynamic centre (fuselage and nacelles move it forward of 25 %)
    aw: 5.0, at: 3.6, eta: 0.9,            // lift slopes per rad (wing-body, tail), tail efficiency
    deda: 0.38, tau: 0.45,                 // downwash gradient, elevator effectiveness (dα_t/dδe)
    St: 31, lt: 16.5, bt: 12.45,           // THS area m², tail arm from wing-body ac m, THS span m
    F: 0.88,                               // free-elevator factor (reversible controls only)
    Sv: 21.5, lv: 16.0, av: 3.0,           // fin area, fin arm, fin lift slope
    kx: 4.6, ky: 7.0, kz: 8.0,             // radii of gyration m
    sweep: 25, dih: 5,
    CD0: 0.0175, e: 0.80,
    xmg: 2.35,                             // main gear contact behind LEMAC, m
    VMO: 350, MMO: 0.82, VD: 381, MD: 0.89,
    thsUp: 13.5, thsDn: 4,                 // THS travel, nose up / nose down
    elUp: 30, elDn: 17,                    // elevator travel
    rig: -3.4                              // THS display datum (deg) so that the model reads like the aircraft's scale
  };
  AC.AR = AC.b * AC.b / AC.S;
  AC.ARt = AC.bt * AC.bt / AC.St;
  AC.VH = AC.St * AC.lt / (AC.S * AC.c);
  AC.Vv = AC.Sv * AC.lv / (AC.S * AC.b);

  const CONF = {
    clean: { CLmax: 1.50, CL0: 0.25, Cm0: -0.14, nmax: 2.5, nmin: -1, CLneg: -0.80, VFE: null },
    conf1: { CLmax: 2.10, CL0: 0.70, Cm0: -0.30, nmax: 2.0, nmin: 0, CLneg: -0.6, VFE: 215 },
    full:  { CLmax: 2.90, CL0: 1.25, Cm0: -0.55, nmax: 2.0, nmin: 0, CLneg: -0.6, VFE: 177 }
  };

  /* ---------------- atmosphere ---------------- */
  function isa(hft) {
    const h = hft * FT; let T, p;
    if (h <= 11000) { T = 288.15 - 0.0065 * h; p = 101325 * Math.pow(T / 288.15, 5.25588); }
    else { T = 216.65; p = 22632.06 * Math.exp(-(h - 11000) * g / (287.053 * 216.65)); }
    const rho = p / (287.053 * T);
    return { T, p, rho, sig: rho / R0, del: p / 101325, a: Math.sqrt(1.4 * 287.053 * T) };
  }
  // EAS (kt) of a Mach number at an altitude, and the reverse
  const easOfMach = (M, hft) => M * A0KT * Math.sqrt(isa(hft).del);
  const machOfEas = (keas, hft) => keas / (A0KT * Math.sqrt(isa(hft).del));

  /* ---------------- CG envelope (illustrative, takeoff/flight) ---------------- */
  function envelope(m) {
    const fwd = m <= 53 ? 15 : 15 + (m - 53) / (78 - 53) * 8;
    const aft = m <= 55 ? 38 + (Math.max(m, 40) - 40) / 15 * 3 : m <= 63 ? 41 : 41 - (m - 63) / 15 * 4;
    return { fwd, aft };
  }

  /* ---------------- neutral and manoeuvre points (fractions of MAC) ---------------- */
  const hn = AC.hac + AC.VH * AC.eta * AC.at / AC.aw * (1 - AC.deda);          // stick fixed
  const hnF = AC.hac + AC.VH * AC.eta * AC.at * AC.F / AC.aw * (1 - AC.deda);  // stick free
  const mu = (m, rho) => 2 * m * 1000 / (rho * AC.S * AC.lt);
  const hm = (m, rho) => hn + AC.VH * AC.eta * AC.at / mu(m, rho);
  const hmF = (m, rho) => hnF + AC.VH * AC.eta * AC.at * AC.F / mu(m, rho);

  /* ---------------- trim: two equations, two unknowns ----------------
     vertical:  Lw + Lt = nW ;  moments about CG:  Lt·lt = nW(h − hac)c + M0   (M0 = q S c Cm0) */
  function trim(o) {
    const C = CONF[o.conf || 'clean'], n = o.n || 1, W = o.m * 1000 * g * n, c = AC.c;
    const M0 = o.q * AC.S * c * C.Cm0;
    const Lt = (W * (o.h - AC.hac) * c + M0) / AC.lt;
    const Lw = W - Lt, CLw = Lw / (o.q * AC.S);
    const alpha = (CLw - C.CL0) / AC.aw, eps = AC.deda * CLw / AC.aw;
    const CLt = Lt / (o.q * AC.St * AC.eta);
    const it = CLt / AC.at - alpha + eps;               // rad, THS incidence, leading edge up +
    const cp = AC.hac - C.Cm0 / CLw;                    // wing-body centre of pressure
    return { W, Lt, Lw, CLw, alpha, eps, CLt, it, ths: thsOf(it), cp, M0 };
  }
  const thsOf = it => AC.rig - it / D2R;              // display: + = UP (nose-up trim, leading edge down)
  const itOf = ths => (AC.rig - ths) * D2R;

  /* stall speed with the tail load at the stall (closed form, q = Lw/(S·CLmax)) */
  function stall(m, h, conf, n) {
    const C = CONF[conf || 'clean'], W = m * 1000 * g * (n || 1), c = AC.c, k = C.Cm0 / C.CLmax;
    const Lt = W * c * ((h - AC.hac) + k) / (AC.lt + c * k);
    return { Lt, Vs: Math.sqrt(2 * (W - Lt) / (R0 * AC.S * C.CLmax)) / KT, Vs0: Math.sqrt(2 * W / (R0 * AC.S * C.CLmax)) / KT };
  }

  /* cruise drag at a fixed Mach and level (trim drag = induced drag of the extra wing lift plus the tail's own) */
  function cruise(m, h, hft, M) {
    const A = isa(hft), V = M * A.a, q = 0.5 * A.rho * V * V, t = trim({ m, h, q, conf: 'clean' });
    const kw = 1 / (Math.PI * AC.AR * AC.e), kt = 1 / (Math.PI * AC.ARt * 0.85);
    const Dw = q * AC.S * (AC.CD0 + kw * t.CLw * t.CLw), Dt = q * AC.St * kt * t.CLt * t.CLt;
    const W = t.W, CL1 = W / (q * AC.S), D0 = q * AC.S * (AC.CD0 + kw * CL1 * CL1);
    return { q, V, rho: A.rho, t, D: Dw + Dt, Dtrim: Dw + Dt - D0, LD: W / (Dw + Dt) };
  }

  /* elevator per g (deg up per g) at dynamic pressure q, air density rho */
  function perG(m, h, q, rho) {
    const CW = m * 1000 * g / (q * AC.S);
    return CW * (hm(m, rho) - h) / (AC.VH * AC.eta * AC.tau * AC.at) / D2R;
  }
  /* classic stick force per g (reversible controls) ∝ (W/S)(h_m' − h); returned relative to 64 t at 15 % MAC */
  function sfg(m, h, rho) { return (m * (hmF(m, rho) - h)) / (64 * (hmF(64, rho) - 0.15)); }

  /* takeoff: trim at V2 in CONF 1+F, and the elevator needed to lift the nose wheel at VR */
  function takeoff(m, h, thsSet) {
    const C = CONF.conf1, W = m * 1000 * g, Vs = Math.sqrt(2 * W / (R0 * AC.S * C.CLmax));
    const V2 = 1.13 * Vs, VR = 1.10 * Vs;
    const tr = trim({ m, h, q: 0.5 * R0 * V2 * V2, conf: 'conf1' });
    const ths = thsSet == null ? tr.ths : thsSet;
    const q = 0.5 * R0 * VR * VR, Lw = q * AC.S * C.CL0, M0 = q * AC.S * AC.c * C.Cm0;
    const xcg = h * AC.c, xac = AC.hac * AC.c, xt = xac + AC.lt, xmg = AC.xmg;
    const Mreq = W * (xmg - xcg) - Lw * (xmg - xac) - M0;      // nose-down moment about the main gear
    const Lt = -Mreq / (xt - xmg);                              // tail lift needed (− = download)
    const CLt = Lt / (q * AC.St * AC.eta), at = itOf(ths) - AC.deda * C.CL0 / AC.aw;
    const de = (CLt - AC.at * at) / (AC.tau * AC.at);          // rad, trailing edge down +
    return { V2: V2 / KT, VR: VR / KT, thsTrim: tr.ths, ths, Lt, elev: -de / D2R, frac: -de / D2R / AC.elUp };
  }

  /* landing: THS frozen at the approach trim (VLS = 1.23 VS1g, CONF FULL); elevator needed to hold the wing at CLmax
     in ground effect (downwash at the tail reduced by GE). This is the classic forward-CG authority case. */
  function flare(m, h, GE) {
    const C = CONF.full, W = m * 1000 * g, ge = GE == null ? 0.4 : GE;
    const Vs = Math.sqrt(2 * W / (R0 * AC.S * C.CLmax)), Vapp = 1.23 * Vs;
    const ap = trim({ m, h, q: 0.5 * R0 * Vapp * Vapp, conf: 'full' });
    const st = stall(m, h, 'full'), qs = (W - st.Lt) / (AC.S * C.CLmax);
    const CLt = st.Lt / (qs * AC.St * AC.eta);
    const aw = (C.CLmax - C.CL0) / AC.aw, eps = AC.deda * C.CLmax / AC.aw * (1 - ge);
    const at = aw - eps + ap.it, de = (CLt - AC.at * at) / (AC.tau * AC.at);
    return { Vapp: Vapp / KT, ths: ap.ths, elev: -de / D2R, frac: -de / D2R / AC.elUp };
  }

  /* ---------------- linear algebra: eigenvalues of a small real matrix ---------------- */
  function charPoly(A) { // Faddeev–LeVerrier: returns c[0..n] with c[0]=1, det(sI−A)=Σ c_k s^(n−k)
    const n = A.length; let M = A.map(r => r.map(() => 0)); const c = [1];
    for (let k = 1; k <= n; k++) {
      const AM = A.map((r, i) => r.map((_, j) => { let s = 0; for (let l = 0; l < n; l++) s += A[i][l] * M[l][j]; return s; }));
      // M_k = A M_{k−1} + c_{k−1} I
      M = AM.map((r, i) => r.map((v, j) => v + (i === j ? c[k - 1] : 0)));
      const AMk = A.map((r, i) => r.map((_, j) => { let s = 0; for (let l = 0; l < n; l++) s += A[i][l] * M[l][j]; return s; }));
      let tr = 0; for (let i = 0; i < n; i++) tr += AMk[i][i];
      c.push(-tr / k);
    }
    return c;
  }
  function roots(c) { // Durand–Kerner on a monic polynomial
    const n = c.length - 1; let z = []; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n + 0.4; z.push([0.9 * Math.cos(a), 0.9 * Math.sin(a)]); }
    const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-30; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
    for (let it = 0; it < 500; it++) {
      let delta = 0;
      z = z.map((zi, i) => {
        let p = [1, 0]; for (let k = 1; k <= n; k++) p = [p[0] * zi[0] - p[1] * zi[1] + c[k], p[0] * zi[1] + p[1] * zi[0]];
        let d = [1, 0]; z.forEach((zj, j) => { if (j !== i) d = mul(d, [zi[0] - zj[0], zi[1] - zj[1]]); });
        const s = div(p, d); delta = Math.max(delta, Math.hypot(s[0], s[1])); return [zi[0] - s[0], zi[1] - s[1]];
      });
      if (delta < 1e-12) break;
    }
    return z.map(r => [r[0], Math.abs(r[1]) < 1e-9 ? 0 : r[1]]);
  }
  function rk4(A, x0, dt, T, every, extra) {
    const n = x0.length, f = (x, t) => { const d = A.map(r => r.reduce((s, a, j) => s + a * x[j], 0)); if (extra) extra(x, d, t); return d; };
    let x = x0.slice(), out = [[0, ...x]], t = 0, k = 0;
    while (t < T - 1e-9) {
      const k1 = f(x, t), x2 = x.map((v, i) => v + dt / 2 * k1[i]), k2 = f(x2, t + dt / 2), x3 = x.map((v, i) => v + dt / 2 * k2[i]), k3 = f(x3, t + dt / 2), x4 = x.map((v, i) => v + dt * k3[i]), k4 = f(x4, t + dt);
      x = x.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); t += dt; k++;
      if (k % every === 0) out.push([t, ...x]);
      if (x.some(v => !isFinite(v) || Math.abs(v) > 1e6)) break;
    }
    return out;
  }
  function mode(r) { const wn = Math.hypot(r[0], r[1]); return { re: r[0], im: Math.abs(r[1]), wn, zeta: wn ? -r[0] / wn : 0, period: r[1] ? 2 * Math.PI / Math.abs(r[1]) : Infinity }; }

  /* ---------------- flight condition (EAS below the Mach limit) ---------------- */
  function cond(m, hft, keas, Mcap) {
    const A = isa(hft), ve = Math.min(keas, easOfMach(Mcap || 0.78, hft)) * KT, V = ve / Math.sqrt(A.sig), q = 0.5 * R0 * ve * ve;
    const W = m * 1000 * g, CL = W / (q * AC.S), CD = AC.CD0 + CL * CL / (Math.PI * AC.AR * AC.e);
    return { A, V, q, keas: ve / KT, M: V / A.a, W, CL, CD, rho: A.rho };
  }

  /* ---------------- longitudinal small-perturbation model: x = [u (m/s), α, q, θ] ---------------- */
  function longModel(o) { // {m, h, hft, keas}
    const k = cond(o.m, o.hft, o.keas), m = o.m * 1000, Iyy = m * AC.ky * AC.ky, qS = k.q * AC.S, V = k.V;
    const CDa = 2 * k.CL * AC.aw / (Math.PI * AC.AR * AC.e);
    const Xu = -2 * qS * k.CD / (m * V), Xa = qS * (k.CL - CDa) / m;
    const Zu = -2 * qS * k.CL / (m * V), Za = -qS * (AC.aw + k.CD) / m;
    const Ma = -qS * AC.c * AC.aw * (hn - o.h) / Iyy;
    const Mq = -qS * AC.c * AC.VH * AC.eta * AC.at * (AC.lt / V) / Iyy, Mad = Mq * AC.deda;
    // with α̇ = Zu/V u + Za/V α + q substituted into q̇
    const A = [
      [Xu, Xa, 0, -g],
      [Zu / V, Za / V, 1, 0],
      [Mad * Zu / V, Ma + Mad * Za / V, Mq + Mad, 0],
      [0, 0, 1, 0]];
    return Object.assign(k, { A, Xu, Xa, Zu, Za, Ma, Mq, Mad, Iyy });
  }
  function longModes(A) {
    const r = roots(charPoly(A)).sort((a, b) => Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1]));
    // largest |λ| pair = short period, smallest = phugoid
    const cx = r.filter(z => z[1] > 0), re = r.filter(z => z[1] === 0);
    let sp = null, ph = null;
    if (cx.length === 2) { sp = mode(cx[0]); ph = mode(cx[1]); }
    else if (cx.length === 1) { const c0 = mode(cx[0]); if (c0.wn > 0.3) sp = c0; else ph = c0; }
    return { r, sp, ph, real: re.map(z => z[0]), unstable: r.some(z => z[0] > 1e-4) };
  }
  /* normal-law pitch: the computer adds pitch damping and holds the flight path (n = 1 with stick free) */
  function longLaw(M, law) {
    if (law !== 'normal') return null;
    // load-factor feedback (nz = −Zα·α/g), pitch-rate damping and a slow flight-path hold: n = 1 with the stick free
    const nzA = -M.Za / g;
    return (x, d) => { const gam = x[3] - x[1]; d[2] += -0.38 * nzA * x[1] - 1.7 * x[2] - 0.35 * gam; };
  }
  function longSim(M, x0, T, dt, law) {
    const ex = longLaw(M, law); const every = Math.max(1, Math.round(T / dt / 600));
    return rk4(M.A, x0, dt, T, every, ex);
  }

  /* ---------------- lateral-directional model: x = [β, p, r, φ] ---------------- */
  function latDerivs(o) { // {m, hft, keas, sweep, dih, fin, yd}
    const k = cond(o.m, o.hft, o.keas), f = o.fin, L = (o.sweep == null ? AC.sweep : o.sweep) * D2R, G = (o.dih == null ? AC.dih : o.dih) * D2R;
    const d = {
      Cyb: -0.25 - AC.av * AC.Sv / AC.S * f,
      ClbG: -AC.aw * G / 6, ClbS: -0.30 * k.CL * Math.tan(L), ClbF: -0.05 * f, ClbB: +0.08,
      Cnb: AC.av * AC.Vv * f - 0.12,
      Clp: -0.45, Cnp: -k.CL / 8, Clr: k.CL / 4 + 0.03 * f,
      Cnr: -2 * AC.av * AC.Vv * (AC.lv / AC.b) * f - 0.02 + (o.yd ? -0.55 : 0)
    };
    d.Clb = d.ClbG + d.ClbS + d.ClbF + d.ClbB;
    return Object.assign(k, { d });
  }
  function latModel(o) {
    const k = latDerivs(o), d = k.d, m = o.m * 1000, Ixx = m * AC.kx * AC.kx, Izz = m * AC.kz * AC.kz, qSb = k.q * AC.S * AC.b, V = k.V, h = AC.b / (2 * V);
    const Yb = k.q * AC.S * d.Cyb / (m * V);
    const Lb = qSb * d.Clb / Ixx, Lp = qSb * d.Clp * h / Ixx, Lr = qSb * d.Clr * h / Ixx;
    const Nb = qSb * d.Cnb / Izz, Np = qSb * d.Cnp * h / Izz, Nr = qSb * d.Cnr * h / Izz;
    const A = [[Yb, 0, -1, g / V], [Lb, Lp, Lr, 0], [Nb, Np, Nr, 0], [0, 1, 0, 0]];
    const r = roots(charPoly(A));
    const cx = r.filter(z => z[1] > 0).map(mode), re = r.filter(z => z[1] === 0).map(z => z[0]).sort((a, b) => a - b);
    let dr = cx[0] || null, roll = null, spiral = null;
    if (re.length >= 2) { roll = re[0]; spiral = re[re.length - 1]; }
    else if (re.length === 1) spiral = re[0];
    if (!dr && re.length === 4) { roll = re[0]; spiral = re[3]; }
    return Object.assign(k, { A, Yb, Lb, Lp, Lr, Nb, Np, Nr, modes: { dr, roll, spiral, r }, Ixx, Izz });
  }
  function latSim(M, x0, T, dt) { const every = Math.max(1, Math.round(T / dt / 900)); return rk4(M.A, x0, dt, T, every); }

  /* ---------------- V-n, gusts, buffet ---------------- */
  // classic discrete-gust formula with the alleviation factor: Δn = Kg·ρ0·Ude·V·a / (2 W/S)
  function gustUde(hft) { // derived gust velocities, ft/s EAS, at VB, VC, VD
    const f = hft <= 20000 ? 0 : Math.min(1, (hft - 20000) / 30000);
    return { B: 66 - 28 * f, C: 50 - 25 * f, D: 25 - 12.5 * f };
  }
  function gust(m, hft, keas, ude) {
    const A = isa(hft), WS = m * 1000 * g / AC.S, muG = 2 * WS / (A.rho * AC.c * AC.aw * g), Kg = 0.88 * muG / (5.3 + muG);
    return { dn: Kg * R0 * (ude * FT) * keas * KT * AC.aw / (2 * WS), Kg, muG, WS };
  }
  function vn(m, hft, conf) {
    const C = CONF[conf], W = m * 1000 * g, WS = W / AC.S;
    const Vs = Math.sqrt(2 * W / (R0 * AC.S * C.CLmax)) / KT, VsN = Math.sqrt(2 * W / (R0 * AC.S * Math.abs(C.CLneg))) / KT;
    const VA = Vs * Math.sqrt(C.nmax);
    let VC, VDd; if (conf === 'clean') { VC = Math.min(AC.VMO, easOfMach(AC.MMO, hft)); VDd = Math.min(AC.VD, easOfMach(AC.MD, hft)); } else { VC = C.VFE; VDd = C.VFE; }
    const U = gustUde(hft), k = u => gust(m, hft, 1, u).dn; // Δn per kt
    const k66 = k(U.B), VB = (Vs * Vs * k66 + Math.sqrt(Math.pow(Vs * Vs * k66, 2) + 4 * Vs * Vs)) / 2;
    return { C, Vs, VsN, VA, VC, VD: VDd, VB, U, kB: k66, kC: k(U.C), kD: k(U.D), WS };
  }
  // buffet onset lift coefficient vs Mach (illustrative A320-like boundary)
  function CLbuf(M) { const base = 1.50 - 1.0 * Math.max(0, M - 0.2); return base - (M > 0.70 ? 18 * Math.pow(M - 0.70, 2) : 0); }
  function buffetMach(m, hft, n) { // low and high buffet Mach at load factor n, or null if above the ceiling
    const A = isa(hft), need = n * m * 1000 * g / (0.7 * A.p * AC.S), f = M => M * M * CLbuf(M) - need;
    let best = 0.3, fb = -1e9; for (let M = 0.3; M <= 0.95; M += 0.005) { const v = f(M); if (v > fb) { fb = v; best = M; } }
    if (fb < 0) return null;
    const bis = (a, b) => { for (let i = 0; i < 50; i++) { const c = (a + b) / 2; (f(a) < 0) === (f(c) < 0) ? a = c : b = c; } return (a + b) / 2; };
    return { lo: f(0.2) < 0 ? bis(0.2, best) : 0.2, hi: f(0.95) < 0 ? bis(best, 0.95) : 0.95, peak: best };
  }
  const rudderLimit = keas => keas <= 160 ? 25 : Math.max(3.4, 25 * Math.pow(160 / keas, 2.3));

  /* ---------------- 3D: tiny polygon renderer ---------------- */
  function rotAxis(p, o, ax, a) { // rotate point p about axis (origin o, unit ax) by a
    const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], c = Math.cos(a), s = Math.sin(a), d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2];
    const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
    return [0, 1, 2].map(i => o[i] + v[i] * c + cr[i] * s + ax[i] * d * (1 - c));
  }
  const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* A320-shaped model. x forward, y right, z up, metres, origin at the CG (25 % MAC).
     def: {ailL, ailR (deg, + = trailing edge down), splL[5], splR[5] (deg up), elev (deg, + = TE up), rud (deg, + = nose right), ths (deg, + = nose-up trim)} */
  const COL = { body: '#C9D2D8', wing: '#AEB9C2', eng: '#D5DCE1', inlet: '#2B333B', ail: '#7FCBE8', spl: '#E46BAE', elev: '#F0B440', rud: '#71CC93', ths: '#B9A6F0', fin: '#BCC6CE' };
  function a320(def) {
    def = def || {}; const F = [], hi = def.hi || {};
    const add = (p, col, tag) => F.push({ p, col, tag });
    // fuselage rings: [x, radius, z-centre]
    const ST = [[17.7, 0.05, -0.35], [17.2, 0.85, -0.25], [16.2, 1.45, -0.1], [14.6, 1.85, 0], [12.6, 1.98, 0], [-8, 1.98, 0], [-11.5, 1.75, 0.2], [-14.5, 1.3, 0.5], [-17.4, 0.75, 0.95], [-19.9, 0.22, 1.35]];
    const NS = 14, ring = s => Array.from({ length: NS }, (_, i) => { const a = 2 * Math.PI * i / NS; return [s[0], s[1] * Math.cos(a), s[2] + s[1] * Math.sin(a) * 1.04]; });
    for (let k = 0; k < ST.length - 1; k++) { const r0 = ring(ST[k]), r1 = ring(ST[k + 1]); for (let i = 0; i < NS; i++) { const j = (i + 1) % NS; add([r0[i], r0[j], r1[j], r1[i]], COL.body, 'body'); } }
    // wing planform per side: root (y 1.9), kink (y 6.3), tip (y 17.05). LE/TE x
    const Lx = y => 4.3 - (y - 1.9) * Math.tan(27 * D2R), Tx = y => y <= 6.3 ? -2.6 : -2.6 - (y - 6.3) / (17.05 - 6.3) * 2.0;
    const Zw = y => -1.25 + (y - 1.9) * Math.tan(AC.dih * D2R);
    const P = (y, f, sd) => [Lx(y) + (Tx(y) - Lx(y)) * f, sd * y, Zw(y) + 0.12 * Math.sin(Math.PI * Math.min(1, f / 0.9))];
    [-1, 1].forEach(sd => {
      const ys = [1.9, 4.2, 6.3, 8.5, 10.7, 12.4, 14.3, 16.2, 17.05];
      for (let k = 0; k < ys.length - 1; k++) {
        const a = ys[k], b = ys[k + 1];
        const isAil = a >= 12.4 && b <= 16.2, isSpl = a >= 4.2 && b <= 12.4 || (a >= 1.9 && b <= 4.2);
        const fh = isAil ? 0.74 : 0.66, fs = 0.80; // hinge line, end of spoiler / start of flap
        add([P(a, 0, sd), P(b, 0, sd), P(b, isSpl ? fh : (isAil ? fh : 1), sd), P(a, isSpl ? fh : (isAil ? fh : 1), sd)], COL.wing, 'wing');
        if (isSpl) {
          add([P(a, fs, sd), P(b, fs, sd), P(b, 1, sd), P(a, 1, sd)], COL.wing, 'flap');
        }
      }
      // spoilers 1–5 (1 = inboard) between y 2.4 and 11.9 on the upper surface, hinge at 0.66 chord
      const sp = [[2.2, 4.0], [4.4, 6.2], [6.6, 8.3], [8.6, 10.3], [10.5, 12.2]];
      const sdef = sd < 0 ? (def.splL || []) : (def.splR || []);
      sp.forEach(([a, b], i) => {
        const h0 = P(a, 0.66, sd), h1 = P(b, 0.66, sd), ax = unit([h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]]);
        const ang = (sdef[i] || 0) * D2R * (sd > 0 ? 1 : -1);
        const pts = [h0, h1, P(b, 0.80, sd), P(a, 0.80, sd)].map((p, j) => j < 2 ? p : rotAxis([p[0], p[1], p[2] + 0.06], h0, ax, ang));
        add(pts, (sdef[i] || 0) > 0.5 ? COL.spl : COL.wing, 'spl' + (sd < 0 ? 'L' : 'R') + (i + 1));
      });
      // aileron y 12.4–16.2, hinge 0.74 chord
      const ad = (sd < 0 ? def.ailL : def.ailR) || 0, h0 = P(12.4, 0.74, sd), h1 = P(16.2, 0.74, sd), ax = unit([h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]]);
      const aa = ad * D2R * (sd > 0 ? -1 : 1);
      add([h0, h1, rotAxis(P(16.2, 1, sd), h0, ax, aa), rotAxis(P(12.4, 1, sd), h0, ax, aa)], Math.abs(ad) > 0.5 || hi.ail ? COL.ail : COL.wing, 'ail' + (sd < 0 ? 'L' : 'R'));
      // engine nacelle
      const ey = sd * 5.75, ez = -2.35, NE = 10;
      const er = (x, r) => Array.from({ length: NE }, (_, i) => { const a = 2 * Math.PI * i / NE; return [x, ey + r * Math.cos(a), ez + r * Math.sin(a)]; });
      const E = [er(7.2, 1.0), er(6.4, 1.12), er(3.0, 1.05), er(1.6, 0.62)];
      for (let k = 0; k < E.length - 1; k++) for (let i = 0; i < NE; i++) { const j = (i + 1) % NE; add([E[k][i], E[k][j], E[k + 1][j], E[k + 1][i]], COL.eng, 'eng'); }
      add(E[0], COL.inlet, 'inlet');
      // pylon
      add([[5.8, ey, ez + 1.0], [2.0, ey, ez + 0.6], [0.6, ey, Zw(5.75) - 0.05], [3.0, ey, Zw(5.75) + 0.05]], COL.wing, 'pylon');
    });
    // THS: pivot near x −15.2; root LE −13.4, tip y 6.2; elevator hinge at 0.70 chord
    const thsA = (def.ths || 0) * D2R, piv = [-15.6, 0, 0.75], yax = [0, 1, 0];
    const TL = y => -13.4 - (y - 1.0) / 5.2 * 3.3, TT = y => -17.2 - (y - 1.0) / 5.2 * 0.8, Tz = 0.75;
    const TP = (y, f, sd) => rotAxis([TL(y) + (TT(y) - TL(y)) * f, sd * y, Tz], piv, yax, thsA);
    [-1, 1].forEach(sd => {
      add([TP(1.0, 0, sd), TP(6.2, 0, sd), TP(6.2, 0.7, sd), TP(1.0, 0.7, sd)], hi.ths || Math.abs(def.ths || 0) > 0.3 ? COL.ths : COL.wing, 'ths');
      const h0 = TP(1.0, 0.7, sd), h1 = TP(6.2, 0.7, sd), ax = unit([h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]]), e = (def.elev || 0) * D2R * (sd > 0 ? 1 : -1);
      add([h0, h1, rotAxis(TP(6.2, 1, sd), h0, ax, e), rotAxis(TP(1.0, 1, sd), h0, ax, e)], Math.abs(def.elev || 0) > 0.5 || hi.elev ? COL.elev : COL.wing, 'elev');
    });
    // fin: root z 1.7 (x −11.6 … −17.6), tip z 8.0 (x −16.3 … −18.9); rudder hinge at 0.68
    const FLx = z => -11.6 - (z - 1.7) / 6.3 * 4.7, FTx = z => -17.6 - (z - 1.7) / 6.3 * 1.3;
    const FP = (z, f) => [FLx(z) + (FTx(z) - FLx(z)) * f, 0, z];
    add([FP(1.7, 0), FP(8.0, 0), FP(8.0, 0.68), FP(1.7, 0.68)], COL.fin, 'fin');
    { const h0 = FP(1.7, 0.68), h1 = FP(8.0, 0.68), ax = unit([h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]]), r = -(def.rud || 0) * D2R;
      add([h0, h1, rotAxis(FP(8.0, 1), h0, ax, r), rotAxis(FP(1.7, 1), h0, ax, r)], Math.abs(def.rud || 0) > 0.5 || hi.rud ? COL.rud : COL.fin, 'rud'); }
    return F;
  }
  // anchors for labels (body axes)
  const ANCH = { ailL: [-3.9, -14.3, -0.35], ailR: [-3.9, 14.3, -0.35], splL: [-0.6, -7.5, -0.6], splR: [-0.6, 7.5, -0.6], elevL: [-17.6, -3.6, 0.75], elevR: [-17.6, 3.6, 0.75], ths: [-14.8, 2.0, 0.75], rud: [-18.3, 0, 5.0], fin: [-14.5, 0, 5.5], cg: [0, 0, 0], tipL: [-4.6, -17.05, 0.0], tipR: [-4.6, 17.05, 0.0] };

  function attMat(psi, th, ph) { // body → world, ψ yaw (nose right +), θ pitch (nose up +), φ roll (right wing down +)
    const cps = Math.cos(psi), sps = Math.sin(psi), ct = Math.cos(th), st = Math.sin(th), cf = Math.cos(-ph), sf = Math.sin(-ph);
    const Rx = [[1, 0, 0], [0, cf, -sf], [0, sf, cf]], Ry = [[ct, 0, -st], [0, 1, 0], [st, 0, ct]], Rz = [[cps, -sps, 0], [sps, cps, 0], [0, 0, 1]];
    const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return mul(Rz, mul(Ry, Rx));
  }
  /* yaw sign: Rz above turns +x toward +y (nose right) for ψ>0 */
  function camera(az, el, cx, cy, scale, persp) {
    const d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const r = unit([d[1], -d[0], 0]), u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
    const f = persp || 140;
    return {
      d, r, u, proj(p) { const z = p[0] * d[0] + p[1] * d[1] + p[2] * d[2], k = f / (f - z) * scale; return [cx + (p[0] * r[0] + p[1] * r[1] + p[2] * r[2]) * k, cy - (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) * k, z]; }
    };
  }
  function render3d(g2, faces, R, cam, opt) {
    opt = opt || {}; const L = unit(opt.light || [0.35, -0.45, 0.82]), off = opt.off || [0, 0, 0];
    const tf = p => { const q = [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]]; return [q[0] + off[0], q[1] + off[1], q[2] + off[2]]; };
    const list = faces.map(f => {
      const w = f.p.map(tf), s = w.map(cam.proj);
      const a = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]], b = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]];
      const n = unit([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
      const z = s.reduce((t, v) => t + v[2], 0) / s.length;
      return { s, z, sh: 0.42 + 0.58 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]), col: f.col, tag: f.tag };
    }).sort((p, q) => p.z - q.z);
    for (const f of list) {
      g2.beginPath(); f.s.forEach((v, i) => i ? g2.lineTo(v[0], v[1]) : g2.moveTo(v[0], v[1])); g2.closePath();
      g2.fillStyle = shade(f.col, f.sh); g2.fill();
      g2.strokeStyle = opt.edge || 'rgba(10,16,22,.35)'; g2.lineWidth = 0.6; g2.stroke();
    }
    return { at: p => cam.proj(tf(p)) };
  }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255; return 'rgb(' + Math.round(r * k) + ',' + Math.round(gg * k) + ',' + Math.round(b * k) + ')'; }

  /* ---------------- dark-instrument chart helpers ---------------- */
  const INK = { bg: '#10171D', bg2: '#18232C', grid: '#1F2B35', rule: '#2A3742', ink: '#D7E1E6', mute: '#8B99A7', dim: '#5E6D7C', cyan: '#7FCBE8', mag: '#E46BAE', amber: '#F0B440', red: '#EC5A47', green: '#71CC93', violet: '#B9A6F0', white: '#EEF3F7' };
  const FONT = { mono: '"IBM Plex Mono", ui-monospace, monospace', body: '"Public Sans", system-ui, sans-serif' };
  function txt(g2, s, x, y, o) { o = o || {}; g2.font = (o.w || (o.mono ? 400 : 600)) + ' ' + (o.size || (o.mono ? 10.5 : 12)) + 'px ' + (o.mono ? FONT.mono : FONT.body); g2.fillStyle = o.col || INK.ink; g2.textAlign = o.al || 'left'; g2.textBaseline = o.bl || 'alphabetic'; if (o.bg) { const w = g2.measureText(s).width, h = (o.size || 11) + 4, x0 = o.al === 'center' ? x - w / 2 : o.al === 'right' ? x - w : x; g2.save(); g2.fillStyle = o.bg; g2.fillRect(x0 - 3, y - h + 4, w + 6, h); g2.restore(); g2.fillStyle = o.col || INK.ink; } g2.fillText(s, x, y); g2.textBaseline = 'alphabetic'; }
  function arrow(g2, x0, y0, x1, y1, col, w, head) { const hl = head || 9; g2.strokeStyle = col; g2.fillStyle = col; g2.lineWidth = w || 2.5; const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return; const xe = x1 - Math.cos(a) * hl * 0.7, ye = y1 - Math.sin(a) * hl * 0.7; g2.beginPath(); g2.moveTo(x0, y0); g2.lineTo(xe, ye); g2.stroke(); g2.beginPath(); g2.moveTo(x1, y1); g2.lineTo(x1 - hl * Math.cos(a - 0.42), y1 - hl * Math.sin(a - 0.42)); g2.lineTo(x1 - hl * Math.cos(a + 0.42), y1 - hl * Math.sin(a + 0.42)); g2.closePath(); g2.fill(); }
  function axes(g2, box, xr, yr, o) { // box {x,y,w,h}; returns X(), Y()
    o = o || {}; const X = v => box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w, Y = v => box.y + box.h - (v - yr[0]) / (yr[1] - yr[0]) * box.h;
    g2.lineWidth = 1; g2.strokeStyle = INK.grid;
    (o.xt || []).forEach(v => { g2.beginPath(); g2.moveTo(X(v), box.y); g2.lineTo(X(v), box.y + box.h); g2.stroke(); if (o.xl !== false) txt(g2, o.xf ? o.xf(v) : String(v), X(v), box.y + box.h + 13, { mono: 1, col: INK.mute, al: 'center', size: 10 }); });
    (o.yt || []).forEach(v => { g2.beginPath(); g2.moveTo(box.x, Y(v)); g2.lineTo(box.x + box.w, Y(v)); g2.stroke(); if (o.yl !== false) txt(g2, o.yf ? o.yf(v) : String(v), box.x - 5, Y(v) + 3.5, { mono: 1, col: INK.mute, al: 'right', size: 10 }); });
    g2.strokeStyle = INK.rule; g2.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
    if (o.zero != null && o.zero >= yr[0] && o.zero <= yr[1]) { g2.strokeStyle = INK.dim; g2.beginPath(); g2.moveTo(box.x, Y(o.zero)); g2.lineTo(box.x + box.w, Y(o.zero)); g2.stroke(); }
    return { X, Y };
  }
  function line(g2, pts, col, w, dash) { g2.strokeStyle = col; g2.lineWidth = w || 2; g2.setLineDash(dash || []); g2.beginPath(); pts.forEach((p, i) => i ? g2.lineTo(p[0], p[1]) : g2.moveTo(p[0], p[1])); g2.stroke(); g2.setLineDash([]); }
  function clear(st) { const g2 = st.ctx; g2.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g2.fillStyle = INK.bg; g2.fillRect(0, 0, st.w, st.h); return g2; }

  const STAB = { g, R0, KT, FT, D2R, AC, CONF, isa, easOfMach, machOfEas, envelope, hn, hnF, hm, hmF, mu, trim, thsOf, itOf, stall, cruise, perG, sfg, takeoff, flare,
    charPoly, roots, rk4, mode, cond, longModel, longModes, longSim, latModel, latSim, latDerivs, gustUde, gust, vn, CLbuf, buffetMach, rudderLimit,
    a320, ANCH, COL, attMat, camera, render3d, INK, FONT, txt, arrow, axes, line, clear, shade };
  if (typeof module === 'object' && module.exports) module.exports = STAB; else root.STAB = STAB;
})(typeof window !== 'undefined' ? window : globalThis);
