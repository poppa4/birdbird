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

  const VMC = { g, R0, KT, FT, D2R, LBF, AC, GND, atm, thrustStatic, geom, qOf, rudderTravel, pedalForce, point, vmc, vs1g, airSim, groundRoll, vmcg, goAround };
  if (typeof module === 'object' && module.exports) module.exports = VMC; else root.VMC = VMC;
})(typeof window !== 'undefined' ? window : globalThis);
