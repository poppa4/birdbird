/* Birdbird – vmc.js: engine-out yaw model and minimum control speeds (VMCA, VMCG, VMCL) for propeller.html.
   Illustrative training values for an A320-size twin, not AFM / FCOM data.
   Frame: y positive toward the LIVE engine. φ > 0 = bank toward the live engine, β > 0 = relative wind from the
   live-engine side, r > 0 = nose toward the live engine, δr > 0 = rudder that yaws the nose toward the live engine.
   Steady straight flight (closed form):
     side force:  qS·Cyβ·β − Yr + W·sinφ = 0
     yaw:         qSb·Cnβ·β + Yr·lv − Neng = 0,  Neng = (T + Dwm)·ye
     ⇒ Yr = (Neng − a·W·sinφ) / (lv − a),   a = b·Cnβ/|Cyβ| (where the sideslip side force acts, behind the CG)
     rudder:      Yr,max = q·Sv·aδ·η·δr,max      (δr,max = travel limit, or the 150 lbf pedal force if lower)
   VMCA is the CAS where Yr(V) = Yr,max(V), found by bisection on that closed form.
   Works in the browser (window.VMC) and in Node (module.exports). */
(function (root) {
  'use strict';
  const g = 9.80665, R0 = 1.225, KT = 0.514444, FT = 0.3048, D2R = Math.PI / 180, LBF = 4.44822;

  const AC = {
    S: 122.6, b: 34.1, c: 4.19,          // wing area m², span m, MAC m
    ye: 5.75,                            // engine arm from the centreline, m
    T0: 120e3,                           // take-off thrust per engine, N, sea level ISA, static
    lapse: 0.0015,                       // thrust lost per kt TAS (ram drag)
    flx: 0.85,                           // FLX thrust as a fraction of TOGA (typical)
    CdAwm: 2.4,                          // windmilling engine: drag area, m² (D = q·CdA)
    Sv: 21.5, lv0: 16.0, href: 0.25,     // fin area m², fin arm from a CG at 25 % MAC, m
    ad: 2.37, eta: 0.90,                 // rudder side-force slope per rad of rudder, fin efficiency
    dmax: 25,                            // rudder travel, deg (limited above 160 kt)
    Cyb: -0.974, Cnb: 0.057,             // whole aircraft, per rad (take-off configuration)
    Clb: -0.10, Clp: -0.45, Cnr: -0.26, Clr: 0.25, Clda: 0.040,
    kx: 4.6, kz: 8.0,                    // radii of gyration, m
    feel0: 20, feel1: 110,               // pedal feel, lbf: breakout + full-travel force (illustrative)
    Fmax: 150,                           // certification pedal force limit, lbf
    mtow: 78, mlw: 66.0, mmin: 42,
    CLmax: { to: 2.10, full: 2.90 }
  };
  AC.a0 = AC.b * AC.Cnb / Math.abs(AC.Cyb);

  /* ---------------- atmosphere and thrust ---------------- */
  function atm(hft, oat) { // pressure altitude ft, OAT °C (null = ISA)
    const h = hft * FT, Tisa = 288.15 - 0.0065 * h, del = Math.pow(Tisa / 288.15, 5.25588);
    const T = oat == null ? Tisa : oat + 273.15, rho = 101325 * del / (287.053 * T), sig = rho / R0;
    const da = (1 - Math.pow(sig, 0.234969)) * 145442.16; // density altitude, ft
    return { del, T, oat: T - 273.15, isa: T - Tisa, rho, sig, da };
  }
  // static take-off thrust per engine: flat rated to ISA+15, then about 0.8 % per °C; falls with pressure
  function thrustStatic(hft, oat) {
    const A = atm(hft, oat), corner = 30 - 1.98 * hft / 1000, flat = A.oat <= corner ? 1 : Math.max(0.6, 1 - 0.008 * (A.oat - corner));
    return AC.T0 * Math.pow(A.del, 0.3) * flat;
  }

  /* condition o: {m (t), h (CG fraction MAC), hft, oat, thr (fraction TOGA), phi (deg), wm (bool)} */
  function geom(o) {
    const dx = ((o.h == null ? 0.38 : o.h) - AC.href) * AC.c; // CG aft of reference, m
    return { lv: AC.lv0 - dx, a: AC.a0 - dx, dx };
  }
  const qOf = vcas => 0.5 * R0 * Math.pow(vcas * KT, 2);
  const rudderTravel = vcas => vcas <= 160 ? AC.dmax : Math.max(3.4, AC.dmax * Math.pow(160 / vcas, 2.3));
  const pedalForce = frac => frac <= 0 ? 0 : AC.feel0 + (AC.feel1 - AC.feel0) * Math.min(1, frac); // lbf, frac of full travel
  // pedal force limit expressed as a travel fraction (feel spring); 1 = travel limits first
  const forceFrac = () => AC.feel1 <= AC.Fmax ? 1 : (AC.Fmax - AC.feel0) / (AC.feel1 - AC.feel0);

  function point(o, vcas) {
    const A = atm(o.hft || 0, o.oat), G = geom(o), q = qOf(vcas), vtas = vcas / Math.sqrt(A.sig);
    const W = o.m * 1000 * g, ph = (o.phi || 0) * D2R;
    const T = thrustStatic(o.hft || 0, o.oat) * (o.thr == null ? 1 : o.thr) * (1 - AC.lapse * vtas);
    const D = o.wm === false ? 0 : q * AC.CdAwm;
    const Neng = (T + D) * AC.ye;
    const Yr = (Neng - G.a * W * Math.sin(ph)) / (G.lv - G.a);            // fin side force the rudder must make, N
    const travel = rudderTravel(vcas), dav = travel * forceFrac();
    const k = q * AC.Sv * AC.ad * AC.eta;                                  // N per rad of rudder
    const Ymax = k * dav * D2R;
    const dreq = Yr / k / D2R;                                             // deg
    const beta = (W * Math.sin(ph) - Yr) / (q * AC.S * Math.abs(AC.Cyb)) / D2R; // deg
    const phi0 = Math.asin(Math.max(-1, Math.min(1, Neng / G.lv / W))) / D2R;   // bank for zero sideslip
    const used = Yr / Ymax;
    return { vcas, vtas, q, T, D, Neng, Yr, Ymax, Nreq: Yr * G.lv, Nav: Ymax * G.lv, dreq, dav, travel, beta, phi0, used,
      pedal: pedalForce(Math.abs(dreq) / travel), W, lv: G.lv, a: G.a, A };
  }
  // VMC: lowest CAS where the rudder can hold it (bisection on the closed form)
  function vmc(o) {
    const f = v => { const p = point(o, v); return p.Ymax - p.Yr; };
    let lo = 40, hi = 260;
    if (f(lo) >= 0) return lo; if (f(hi) < 0) return null;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; f(m) >= 0 ? hi = m : lo = m; }
    return hi;
  }
  // stall speed (1 g), kt CAS
  const vs1g = (m, conf) => Math.sqrt(2 * m * 1000 * g / (R0 * AC.S * AC.CLmax[conf])) / KT;

  /* ---------------- airborne time history after a sudden failure ----------------
     states: β, r, p, φ, ψ (rad, rad/s). Speed held constant. Pilot: recognition delay, then rudder toward the
     steady value plus heading feedback (rate limited, saturated), ailerons toward the target bank. */
  function airSim(o, vcas, opt) {
    opt = opt || {};
    const P = point(o, vcas), G = geom(o), m = o.m * 1000, V = P.vtas * KT, q = P.q, S = AC.S, b = AC.b;
    const Izz = m * AC.kz * AC.kz, Ixx = m * AC.kx * AC.kx, W = P.W, hb = b / (2 * V);
    const k = q * AC.Sv * AC.ad * AC.eta, Yb = q * S * Math.abs(AC.Cyb), Nb = Yb * G.a;
    const Nr = q * S * b * AC.Cnr * hb, Lb = q * S * b * AC.Clb, Lp = q * S * b * AC.Clp * hb, Lr = q * S * b * AC.Clr * hb, Lam = q * S * b * AC.Clda;
    const dlim = P.dav * D2R, dss = Math.max(-dlim, Math.min(dlim, P.dreq * D2R)), phT = (o.phi || 0) * D2R;
    const td = opt.delay == null ? 1.0 : opt.delay, Tend = opt.T || 14, dt = 0.02, tau = 0.9;
    let be = 0, r = 0, p = 0, ph = 0, ps = 0, dr = 0, t = 0;
    const out = []; let psMin = 0, phMin = 0;
    while (t <= Tend + 1e-9) {
      const e = 1 - Math.exp(-t / tau), Neng = -(P.T * e + P.D * e) * AC.ye;  // dead engine spools down, drag builds
      let dc = 0, ac = 0;
      if (t >= td) {
        dc = dss - 1.6 * ps - 2.2 * r;                                       // pedal: steady value + heading feedback
        ac = Math.max(-1, Math.min(1, 2.5 * (phT - ph) - 1.5 * p));
      }
      dc = Math.max(-dlim, Math.min(dlim, dc));
      const rate = 40 * D2R * dt; dr += Math.max(-rate, Math.min(rate, dc - dr));
      const Yr = k * dr;
      const db = (-Yb * be - Yr + W * Math.sin(ph)) / (m * V) - r;
      const dr_ = (Nb * be + Nr * r + Yr * G.lv + Neng) / Izz;
      const dp = (Lb * be + Lp * p + Lr * r + Lam * ac) / Ixx;
      if (out.length === 0 || Math.round(t / dt) % 5 === 0) out.push({ t, be: be / D2R, r: r / D2R, ph: ph / D2R, ps: ps / D2R, dr: dr / D2R, ail: ac });
      be += db * dt; r += dr_ * dt; p += dp * dt; ph += p * dt; ps += r * dt; t += dt;
      be = Math.max(-0.6, Math.min(0.6, be)); ph = Math.max(-1.4, Math.min(1.4, ph));
      psMin = Math.min(psMin, ps); phMin = Math.min(phMin, ph);
    }
    const last = out[out.length - 1], prev = out[Math.max(0, out.length - 26)];
    return { tr: out, hdgMax: -psMin / D2R, bankMin: phMin / D2R, rate: (last.ps - prev.ps) / Math.max(0.1, last.t - prev.t), P };
  }

  /* ---------------- ground roll: VMCG ----------------
     Rudder only (no nose-wheel steering), wings level, the main-gear tyres make the path follow the heading.
     Pilot: recognition delay, then full rudder, easing off to bring the heading back parallel. */
  const GND = { Cr: 4e6, acc: 2.5, delay: 1.0, ramp: 0.6 };
  function groundRoll(o, vef, keep) {
    const m = o.m * 1000, Izz = m * AC.kz * AC.kz, dt = 0.02, A = atm(o.hft || 0, o.oat);
    let V = vef, r = 0, psi = 0, y = 0, x = 0, t = 0, ymax = 0, dr = 0, turned = false;
    const tr = keep ? [{ x: 0, y: 0, psi: 0, t: 0, dr: 0 }] : null;
    const xw = (o.xw || 0) * KT;  // crosswind from the dead-engine side, m/s (negative = from the live side)
    while (t < 25) {
      const q = qOf(V), vt = V / Math.sqrt(A.sig), e = 1 - Math.exp(-t / 0.9);
      const T = thrustStatic(o.hft || 0, o.oat) * (o.thr == null ? 1 : o.thr) * (1 - AC.lapse * vt);
      const Neng = -(T + q * AC.CdAwm) * AC.ye * e;
      const travel = rudderTravel(V) * forceFrac() * D2R, k = q * AC.Sv * AC.ad * AC.eta;
      const Nxw0 = -q * AC.S * AC.b * AC.Cnb * 0.8 * Math.atan2(xw, V * KT);
      let dc = 0;
      if (t >= GND.delay) { const need = -(Neng + Nxw0) / (k * AC.lv0); dc = need + 3.0 * (-psi) - 2.5 * r; }
      dc = Math.max(-travel, Math.min(travel, dc));
      const rate = travel / GND.ramp * dt; dr += Math.max(-rate, Math.min(rate, dc - dr));
      const Vm = V * KT, bw = Math.atan2(xw, Vm);                      // weathercock: wind from the dead side yaws toward it
      const Nxw = -q * AC.S * AC.b * AC.Cnb * 0.8 * bw;
      const rd = (Neng + k * dr * AC.lv0 + Nxw - GND.Cr * r) / Izz;
      r += rd * dt; psi += r * dt; y += Vm * Math.sin(psi) * dt; x += Vm * Math.cos(psi) * dt; V += GND.acc * dt; t += dt;
      if (y < ymax) ymax = y;                                               // y < 0 = toward the dead engine
      if (tr && Math.round(t / dt) % 4 === 0) tr.push({ x, y, psi, t, dr: dr / D2R });
      if (psi < -0.3 * D2R) turned = true;
      const settled = t > 8 && Math.abs(r) < 0.05 * D2R && Math.abs(psi) < 0.3 * D2R;
      if ((turned && psi >= -0.02 * D2R) || settled) {
        if (tr) for (let k2 = 1; k2 <= 25; k2++) tr.push({ x: x + k2 * Vm * 0.1, y, psi: 0, t: t + k2 * 0.1, dr: dr / D2R });
        return { dev: -ymax / FT, ok: true, tr, t, x };
      }
      if (-y / FT > 120) break;
    }
    return { dev: Math.max(-ymax / FT, 120), ok: false, tr, t, x };
  }
  function vmcg(o) { let lo = 60, hi = 180; for (let i = 0; i < 28; i++) { const mm = (lo + hi) / 2, r = groundRoll(o, mm); (r.ok && r.dev <= 30) ? hi = mm : lo = mm; } return hi; }

  /* ---------------- go-around in the landing configuration: thrust on the live engine spools up ---------------- */
  function goAround(o, vcas) { // approach thrust ≈ 35 % → TOGA over ~5 s (illustrative spool-up)
    const out = [];
    for (let t = 0; t <= 10.0001; t += 0.1) {
      const f = 0.35 + 0.65 * Math.min(1, Math.max(0, (t - 1) / 5)) ** 1.4;
      const p = point(Object.assign({}, o, { thr: f }), vcas);
      out.push({ t, f, used: p.used, Nreq: p.Nreq });
    }
    return out;
  }


  /* =====================================================================
     Light-twin teaching model (own design, no real type): both propellers turn clockwise seen from behind.
     Frame as above: y > 0 toward the LIVE engine, φ > 0 = bank toward the live engine.
     Yaw from the engines:  Neng = T·(ye ± e) + D·ye − Nss
       e   = P-factor offset of the thrust line toward the descending (right-hand) blade, grows with angle of attack;
             + when the RIGHT engine is the live one (left failed), − when the left engine is live
       D   = drag of the dead propeller: windmilling (large) or feathered (small)
       Nss = spiralling slipstream of the live LEFT engine striking the fin from the left (helps only when the right fails)
     Rolling moment toward the dead engine (held with aileron): accelerated slipstream over the live wing + torque reaction.
     Fin, rudder and sideslip: the same closed form as the jet model (Yr = (Neng − a·W·sinφ)/(lv − a)).
     ===================================================================== */
  const LT = {
    S: 17.5, b: 11.8, ye: 1.85, R: 0.95,     // wing area m², span m, engine arm m, propeller radius m
    P0: 150e3, eta: 0.80, Ts: 3700, rpm: 2700, // power per engine W (180 hp), prop efficiency, static thrust N, rpm
    CdAwm: 0.62, CdAft: 0.06,                // drag area of a windmilling / feathered propeller, m²
    Sv: 2.0, lv0: 5.15, cgRange: 0.45,      // fin area m², fin arm at forward CG limit m, CG range m (fwd→aft)
    ad: 2.4, ehta: 0.90, dmax: 25,           // rudder side-force slope per rad, fin efficiency, rudder travel deg
    Cyb: -0.62, Cnb: 0.10,                  // per rad
    kp: 0.020,                               // P-factor offset, fraction of R per degree of angle of attack
    ass: 0.80, yas: 2.35,                    // accelerated slipstream: extra lift per N thrust, its arm (m)
    css: 0.14,                               // spiralling slipstream: equivalent arm m of the live left engine's thrust
    CLa: 0.088, a0: -2.0, CLmax: 1.65,       // lift slope per deg, zero-lift AoA, CLmax (clean)
    mmax: 2000, mmin: 1500
  };
  LT.a = LT.b * LT.Cnb / Math.abs(LT.Cyb);
  // o: {fail:'L'|'R', m kg, cg 0..1 (fwd→aft), phi deg (toward live), pw 0..1, feather bool}
  function ltPoint(o, v) {
    const q = qOf(v), V = Math.max(1, v * KT), W = o.m * g, ph = (o.phi || 0) * D2R, pw = o.pw == null ? 1 : o.pw;
    const T = Math.min(LT.Ts * pw, LT.eta * LT.P0 * pw / V);
    const CL = W * Math.cos(ph) / (q * LT.S), al = Math.min(CL, LT.CLmax) / LT.CLa + LT.a0;   // wing angle of attack, deg (held at the stall)
    const e = LT.R * LT.kp * Math.max(0, al);                              // thrust line offset toward the descending blade
    const live = o.fail === 'L' ? 'R' : 'L', sgn = live === 'R' ? 1 : -1;  // right engine live → its thrust line moves OUT
    const armT = LT.ye + sgn * e;
    const D = q * (o.feather ? LT.CdAft : LT.CdAwm);
    const Nss = live === 'L' ? LT.css * T : 0;
    const NT = T * armT, ND = D * LT.ye, Neng = NT + ND - Nss;
    const dx = (o.cg == null ? 1 : o.cg) * LT.cgRange, lv = LT.lv0 - dx, a = LT.a - dx;
    const k = q * LT.Sv * LT.ad * LT.ehta, Ymax = k * LT.dmax * D2R;
    const Yr = (Neng - a * W * Math.sin(ph)) / (lv - a);
    const dreq = Yr / k / D2R, beta = (W * Math.sin(ph) - Yr) / (q * LT.S * Math.abs(LT.Cyb)) / D2R;
    const Q = pw * LT.P0 / (LT.rpm * 2 * Math.PI / 60);                   // torque N·m; reaction rolls LEFT
    const yasArm = LT.yas + sgn * e;                                       // slipstream centre follows the descending blade
    const Las = LT.ass * T * yasArm, Ltq = live === 'R' ? Q : -Q;          // + = roll toward the dead engine
    const vs = Math.sqrt(2 * W / (R0 * LT.S * LT.CLmax)) / KT;
    return { v, q, T, D, e, armT, NT, ND, Nss, Neng, Yr, Ymax, Nreq: Yr * lv, Nav: Ymax * lv, NavRaw: Ymax * lv, dreq, beta, al, CL,
      lv, a, W, Las, Ltq, Lroll: Las + Ltq, Q, vs, used: Yr / Ymax, live,
      phi0: Math.asin(Math.max(-1, Math.min(1, Neng / lv / W))) / D2R };
  }
  function ltVmc(o) {
    const f = v => { const p = ltPoint(o, v); return p.Ymax - p.Yr; };
    let lo = 40, hi = 200; if (f(lo) >= 0) return lo; if (f(hi) < 0) return null;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; f(m) >= 0 ? hi = m : lo = m; } return hi;
  }

  /* ---------------- blade element: the propeller as a rotating wing ----------------
     section at 0.75 R: rotational speed U = ω·r, axial speed V (TAS + a little induced flow when it makes thrust),
     helix angle φ = atan(V/U), angle of attack α = β − φ. Thin-aerofoil lift with a stall, profile drag. */
  function blade(o) { // o: {rpm, tas kt, beta deg}
    const r = 0.75 * LT.R, U = Math.max(0, o.rpm) * 2 * Math.PI / 60 * r, V = Math.max(0, o.tas) * KT;
    const phi = Math.atan2(V, Math.max(U, 1e-6)) / D2R, al = o.beta - phi, W = Math.hypot(U, V);
    const ast = 15, cl = Math.abs(al) <= ast ? 0.10 * al : Math.sign(al) * (1.5 - 0.035 * (Math.abs(al) - ast));
    const cd = 0.012 + 0.0009 * al * al + (Math.abs(al) > ast ? 0.4 : 0);
    const ph = phi * D2R, Lr = cl, Dr = cd;                                // per unit q·c
    const thrust = Lr * Math.cos(ph) - Dr * Math.sin(ph), torque = Lr * Math.sin(ph) + Dr * Math.cos(ph);
    const qd = W * W;                                                       // ∝ dynamic pressure on the section
    return { U, V, W, phi, al, cl, cd, thrust: thrust * qd, torque: torque * qd, tipMach: Math.hypot(U / 0.75, V) / 340.3, adv: V / Math.max(1e-6, (o.rpm / 60) * 2 * LT.R) };
  }

  const VMC = { LT, ltPoint, ltVmc, blade, g, R0, KT, FT, D2R, LBF, AC, GND, atm, thrustStatic, geom, qOf, rudderTravel, pedalForce, point, vmc, vs1g, airSim, groundRoll, vmcg, goAround };
  if (typeof module === 'object' && module.exports) module.exports = VMC; else root.VMC = VMC;
})(typeof window !== 'undefined' ? window : globalThis);
