/* Virtual Lab – aerodynamikk-kjerne v2
   Virvelgitter med paneler både langs spennet og korden (krumning og klaff
   som randbetingelse), tykkelse og skrog/naceller som kildefordelinger,
   strømningsfelt beregnet på et rutenett i Web Workers.
   Pedagogisk modell: tallene er omtrentlige. */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180;
  const NS = 30;   // striper langs spennet
  const NC = 5;    // paneler langs korden
  const NT = 10;   // tykkelseskilder per stripe
  const FAR = 300;

  const AIRFOILS = {
    n0012: { name: 'NACA 0012', m: 0, p: 0.4, t: 0.12, clmax: 1.50, cd0: 0.0058, note: 'Symmetrisk' },
    n2412: { name: 'NACA 2412', m: 0.02, p: 0.4, t: 0.12, clmax: 1.60, cd0: 0.0062, note: 'Klassisk småfly' },
    n4412: { name: 'NACA 4412', m: 0.04, p: 0.4, t: 0.12, clmax: 1.68, cd0: 0.0068, note: 'Høy krumning' },
    nlf:   { name: 'Laminarprofil', m: 0.025, p: 0.5, t: 0.15, clmax: 1.50, cd0: 0.0048, note: 'Lav motstand' },
    sc:    { name: 'Superkritisk', m: 0.018, p: 0.7, t: 0.11, clmax: 1.55, cd0: 0.0060, note: 'Jetfly' },
    flat:  { name: 'Flat plate', m: 0, p: 0.4, t: 0.02, clmax: 0.85, cd0: 0.0120, note: 'Ingen profil' }
  };

  /* Flytyper. Mål i meter, x fra nesen, z fra skrogets referanselinje.
     st: skrogstasjoner [x, halv bredde, topp z, bunn z]. */
  /* A320 (typiske verdier, omtrentlig geometri). Mål i meter, x fra nesen, z fra skrogaksen.
     st: skrogstasjoner [x, halv bredde, topp z, bunn z]. Vingen har knekk i bakkanten (Yehudi). */
  const AIRCRAFT = {
    a320: { name: 'A320', full: 'Airbus A320', b: 35.8, cr: 5.9, ck: 3.8, yk: 0.352, ct: 1.5, sweep: 27, dih: 5.1, twist: -4, af: 'sc',
      mass: 64000, massRange: [42000, 78000], ias: 250, iasRange: [100, 350], cd0: 0.018, slats: true, fowler: true, flapSpan: 0.76,
      model: {
        xle: 12.25, zw: -1.3, n: 2.0,
        st: [[0, 0.05, -0.22, -0.32], [0.35, 0.64, 0.22, -0.9], [0.95, 1.1, 0.7, -1.33], [1.8, 1.48, 1.17, -1.68], [2.9, 1.78, 1.58, -1.93],
             [4.2, 1.95, 1.9, -2.05], [5.6, 1.98, 2.02, -2.08], [21.5, 1.98, 2.02, -2.08], [24.5, 1.96, 2.02, -1.98], [27.5, 1.82, 1.99, -1.5],
             [30.5, 1.48, 1.9, -0.7], [33.5, 1.0, 1.75, 0.18], [36.0, 0.5, 1.6, 0.85], [37.57, 0.14, 1.45, 1.22]],
        cockpit: { x0: 1.5, x1: 3.35 },
        nac: [{ y: 5.75, x0: -2.75, L: 4.45, r: 1.12, dz: -1.42, fan: true }],
        winglet: { h: 2.43, tc: 0.32, sweep: 52, cant: 82 },
        vt: { x: 29.4, z: 1.75, c0: 5.9, c1: 1.95, h: 5.85, sweep: 36, t: 0.11 },
        ht: { x: 31.7, z: 0.55, c0: 3.75, c1: 1.3, span: 12.45, sweep: 31, dih: 6, t: 0.1 } } }
  };
  /* Klaffinnstillinger (typiske A320-verdier): lamell (slat) og klaff i grader, VFE i kt */
  const CONFS = [
    { id: '0', s: 0, f: 0, vfe: null }, { id: '1', s: 18, f: 0, vfe: 230 }, { id: '1+F', s: 18, f: 10, vfe: 215 },
    { id: '2', s: 22, f: 15, vfe: 200 }, { id: '3', s: 22, f: 20, vfe: 185 }, { id: 'FULL', s: 27, f: 35, vfe: 177 }];

  function camber(af, x) {
    const { m, p } = af;
    if (m === 0) return [0, 0];
    if (x < p) return [m / (p * p) * (2 * p * x - x * x), 2 * m / (p * p) * (p - x)];
    return [m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * x - x * x), 2 * m / ((1 - p) * (1 - p)) * (p - x)];
  }
  function thick(af, x) { // full tykkelse / korde
    x = Math.max(0, Math.min(1, x));
    return 10 * af.t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  }

  /* ---------- ISA ---------- */
  function atmosphere(altFt, isaDev) {
    const R = 287.053, g = 9.80665, T0 = 288.15, L = 0.0065, h = altFt * 0.3048;
    let Tisa, p;
    if (h <= 11000) { Tisa = T0 - L * h; p = 101325 * Math.pow(Tisa / T0, 5.25588); }
    else { Tisa = 216.65; p = 22632.06 * Math.exp(-g * (h - 11000) / (R * 216.65)); }
    const T = Tisa + isaDev, rho = p / (R * T), sigma = rho / 1.225, rho11 = 0.36392;
    const hd = rho >= rho11 ? (T0 / L) * (1 - Math.pow(sigma, 1 / 4.25588)) : 11000 + (R * 216.65 / g) * Math.log(rho11 / rho);
    return { T, Tisa, p, rho, sigma, densAltFt: hd / 0.3048, a: Math.sqrt(1.4 * R * T) };
  }

  function segVel(px, py, pz, ax, ay, az, bx, by, bz, core2, out) {
    const r1x = px - ax, r1y = py - ay, r1z = pz - az, r2x = px - bx, r2y = py - by, r2z = pz - bz;
    const cx = r1y * r2z - r1z * r2y, cy = r1z * r2x - r1x * r2z, cz = r1x * r2y - r1y * r2x;
    const r0x = bx - ax, r0y = by - ay, r0z = bz - az;
    const l2 = r0x * r0x + r0y * r0y + r0z * r0z, c2 = cx * cx + cy * cy + cz * cz;
    const r1 = Math.sqrt(r1x * r1x + r1y * r1y + r1z * r1z), r2 = Math.sqrt(r2x * r2x + r2y * r2y + r2z * r2z);
    if (r1 < 1e-9 || r2 < 1e-9 || c2 < 1e-12 * l2) return;
    const k = ((r0x * r1x + r0y * r1y + r0z * r1z) / r1 - (r0x * r2x + r0y * r2y + r0z * r2z) / r2) / (4 * Math.PI * (c2 + core2 * l2));
    out[0] += k * cx; out[1] += k * cy; out[2] += k * cz;
  }

  /* ---------- Vinge: geometri og virvelgitter (vingeramme: x bak, y høyre, z opp; spenn = 10) ---------- */
  function buildWing(g) {
    const af = AIRFOILS[g.af];
    const k = 10 / g.b, s = 5, cr = g.cr * k, ct = (g.ct != null ? g.ct : g.cr * g.taper) * k;
    const yk = g.yk ? g.yk * s : 0, ck = g.ck ? g.ck * k : 0;
    const tS = Math.tan(g.sweep * DEG), tD = Math.tan(g.dih * DEG), sD = Math.sin(g.dih * DEG), cD = Math.cos(g.dih * DEG);
    const chord = yk ? (y => { const a = Math.abs(y); return a < yk ? cr + (ck - cr) * a / yk : ck + (ct - ck) * (a - yk) / (s - yk); })
                     : (y => cr + (ct - cr) * Math.abs(y) / s);
    const xle = y => Math.abs(y) * tS;
    const zw = y => Math.abs(y) * tD;
    const ye = new Float64Array(NS + 1);
    for (let i = 0; i <= NS; i++) ye[i] = -s * Math.cos(Math.PI * i / NS);

    const d = g.flapDeg, eta = d <= 20 ? 1 : Math.max(0.55, 1 - (d - 20) / 60);
    const dEff = d * 0.72 * eta * DEG;                       // viskøst redusert klaffeffekt
    // Fowler-klaff: korden forlenges i tillegg, så økningen i cl maks er større enn for en enkel klaff
    const dCl = g.fowler ? Math.min(1.5, 0.043 * d) : Math.min(0.85, 0.022 * d), dCd = 0.00012 * Math.pow(d, 1.5);
    const fowl = g.fowler ? 1 + 0.0045 * d : 1;              // effektiv kordeforlengelse (≈ +16 % ved 35°)
    // forkantlameller (slats) øker kritisk α og cl maks, men gir lite ekstra løft ved samme α
    const sl = g.slatDeg || 0, dClS = Math.min(0.75, 0.027 * sl), slFrom = 0.11 * s;
    const fs = g.flapSpan * s;

    const NP = NS * NC;
    const Pa = new Float64Array(NP * 6);               // bundet virvel A,B
    const Pc = new Float64Array(NP * 3), Pn = new Float64Array(NP * 2);
    const rhsA = new Float64Array(NP), rhsB = new Float64Array(NP);
    const c = new Float64Array(NS), dy = new Float64Array(NS), ym = new Float64Array(NS), clmax = new Float64Array(NS), cd0 = new Float64Array(NS);
    const flap = new Uint8Array(NS);
    for (let j = 0; j < NS; j++) {
      const ya = ye[j], yb = ye[j + 1], y = 0.5 * (ya + yb);
      const inF = d > 0 && Math.abs(y) <= fs + 1e-9;
      flap[j] = inF ? 1 : 0;
      c[j] = chord(y); dy[j] = yb - ya; ym[j] = y;
      const inS = sl > 0 && Math.abs(y) >= slFrom && Math.abs(y) <= 0.985 * s;
      clmax[j] = af.clmax + (inF ? dCl : 0) + (inS ? dClS : 0); cd0[j] = af.cd0 + (inF ? dCd : 0) + (inS ? 0.0002 * sl : 0);
      const theta = g.twist * DEG * Math.abs(y) / s;
      const ny = y >= 0 ? -sD : sD;
      for (let q = 0; q < NC; q++) {
        const p = j * NC + q, x0 = q / NC, dx = 1 / NC;
        const xbnd = x0 + 0.25 * dx, xcp = x0 + 0.75 * dx;
        const zb_a = camber(af, xbnd)[0], [zc, sl] = camber(af, xcp);
        Pa[6 * p] = xle(ya) + chord(ya) * xbnd; Pa[6 * p + 1] = ya; Pa[6 * p + 2] = zw(ya) + chord(ya) * zb_a;
        Pa[6 * p + 3] = xle(yb) + chord(yb) * xbnd; Pa[6 * p + 4] = yb; Pa[6 * p + 5] = zw(yb) + chord(yb) * zb_a;
        Pc[3 * p] = xle(y) + c[j] * xcp; Pc[3 * p + 1] = y; Pc[3 * p + 2] = zw(y) + c[j] * zc;
        Pn[2 * p] = ny; Pn[2 * p + 1] = cD;
        let slope = sl;
        if (inF && xcp > 0.75) slope -= Math.tan(dEff) * fowl;
        rhsA[p] = -cD; rhsB[p] = -(theta - slope) * cD;
      }
    }
    // påvirkningsmatrise
    const AIC = new Float64Array(NP * NP), v = [0, 0, 0];
    for (let i = 0; i < NP; i++) {
      const px = Pc[3 * i], py = Pc[3 * i + 1], pz = Pc[3 * i + 2], nY = Pn[2 * i], nZ = Pn[2 * i + 1];
      for (let p = 0; p < NP; p++) {
        const ax = Pa[6 * p], ay = Pa[6 * p + 1], az = Pa[6 * p + 2], bx = Pa[6 * p + 3], by = Pa[6 * p + 4], bz = Pa[6 * p + 5];
        v[0] = v[1] = v[2] = 0;
        segVel(px, py, pz, ax + FAR, ay, az, ax, ay, az, 0, v);
        segVel(px, py, pz, ax, ay, az, bx, by, bz, 0, v);
        segVel(px, py, pz, bx, by, bz, bx + FAR, by, bz, 0, v);
        AIC[i * NP + p] = v[1] * nY + v[2] * nZ;
      }
    }
    const [Ga, Gb] = solve2(AIC, rhsA, rhsB);
    // stripesummer
    const Sa = new Float64Array(NS), Sb = new Float64Array(NS);
    for (let j = 0; j < NS; j++) for (let q = 0; q < NC; q++) { Sa[j] += Ga[j * NC + q]; Sb[j] += Gb[j * NC + q]; }
    // Trefftz-plan
    const Wt = new Float64Array(NS * NS);
    for (let i = 0; i < NS; i++) {
      const qy = ym[i], qz = zw(qy), nY = qy >= 0 ? -sD : sD;
      for (let j = 0; j < NS; j++) {
        v[0] = v[1] = v[2] = 0;
        segVel(0, qy, qz, FAR, ye[j], zw(ye[j]), -FAR, ye[j], zw(ye[j]), 0, v);
        segVel(0, qy, qz, -FAR, ye[j + 1], zw(ye[j + 1]), FAR, ye[j + 1], zw(ye[j + 1]), 0, v);
        Wt[i * NS + j] = 0.5 * (v[1] * nY + v[2] * cD);
      }
    }
    const wa = new Float64Array(NS), wb = new Float64Array(NS);
    for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) { wa[i] += Wt[i * NS + j] * Sa[j]; wb[i] += Wt[i * NS + j] * Sb[j]; }

    const S = yk ? yk * (cr + ck) + (s - yk) * (ck + ct) : s * (cr + ct);
    let CLa = 0, CLb = 0;
    for (let j = 0; j < NS; j++) { CLa += Sa[j] * dy[j]; CLb += Sb[j] * dy[j]; }
    CLa *= 2 / S; CLb *= 2 / S;
    let aS = Infinity, jS = 0;
    for (let j = 0; j < NS; j++) {
      if (Sa[j] <= 0) continue;
      const aj = (clmax[j] * c[j] / 2 - Sb[j]) / Sa[j];
      if (aj < aS) { aS = aj; jS = j; }
    }
    // samlet hesteskovirvel per stripe (brukes langt fra vingen i feltet)
    const SL = new Float64Array(NS * 12);
    for (let j = 0; j < NS; j++) {
      const ya = ye[j], yb = ye[j + 1], y = ym[j], zb_ = camber(af, 0.25)[0], o = 12 * j;
      SL[o] = xle(ya) + chord(ya) * 0.25; SL[o + 1] = ya; SL[o + 2] = zw(ya) + chord(ya) * zb_;
      SL[o + 3] = xle(yb) + chord(yb) * 0.25; SL[o + 4] = yb; SL[o + 5] = zw(yb) + chord(yb) * zb_;
      SL[o + 6] = xle(y) + c[j] * 0.5; SL[o + 7] = Math.pow(Math.max(2.2 * c[j], 3 * Math.abs(dy[j])), 2);
      SL[o + 8] = xle(ya) + chord(ya); SL[o + 9] = zw(ya); SL[o + 10] = xle(yb) + chord(yb); SL[o + 11] = zw(yb);
    }
    // bakkantpunkter for hver panelende (der virvelbenene forlater vingen)
    const PT = new Float64Array(NP * 4);
    for (let p = 0; p < NP; p++) {
      const ya = Pa[6 * p + 1], yb = Pa[6 * p + 4];
      PT[4 * p] = xle(ya) + chord(ya); PT[4 * p + 1] = zw(ya); PT[4 * p + 2] = xle(yb) + chord(yb); PT[4 * p + 3] = zw(yb);
    }
    const Sreal = S / (k * k);
    return {
      SL, PT, N: NS, NC, NP, s, k, yk, slat: sl, slFrom, ye, c, dy, ym, clmax, cd0, flap, Ga, Gb, Sa, Sb, wa, wb, S, CLa, CLb, Pa,
      alphaStall: aS, stallStation: ym[jS] / s, CLmax: CLa * aS + CLb, chord, xle, zw, cr, ct, af,
      Sreal, AR: g.b * g.b / Sreal, mac: Sreal / g.b, dEff: dEff / DEG, fs, fowl
    };
  }

  function solve2(Ain, b1, b2) {
    const n = b1.length, A = Float64Array.from(Ain), x1 = Float64Array.from(b1), x2 = Float64Array.from(b2);
    for (let col = 0; col < n; col++) {
      let piv = col, best = Math.abs(A[col * n + col]);
      for (let r = col + 1; r < n; r++) { const q = Math.abs(A[r * n + col]); if (q > best) { best = q; piv = r; } }
      if (piv !== col) {
        for (let k = 0; k < n; k++) { const t = A[col * n + k]; A[col * n + k] = A[piv * n + k]; A[piv * n + k] = t; }
        let t = x1[col]; x1[col] = x1[piv]; x1[piv] = t; t = x2[col]; x2[col] = x2[piv]; x2[piv] = t;
      }
      const d = A[col * n + col];
      for (let r = col + 1; r < n; r++) {
        const f = A[r * n + col] / d; if (f === 0) continue;
        for (let k = col; k < n; k++) A[r * n + k] -= f * A[col * n + k];
        x1[r] -= f * x1[col]; x2[r] -= f * x2[col];
      }
    }
    for (let r = n - 1; r >= 0; r--) {
      let s1 = x1[r], s2 = x2[r];
      for (let k = r + 1; k < n; k++) { s1 -= A[r * n + k] * x1[k]; s2 -= A[r * n + k] * x2[k]; }
      x1[r] = s1 / A[r * n + r]; x2[r] = s2 / A[r * n + r];
    }
    return [x1, x2];
  }

  function evaluate(w, alphaDeg, acCd0) {
    const a = alphaDeg * DEG, n = w.N;
    const G = new Float64Array(n), cl = new Float64Array(n), ratio = new Float64Array(n), ai = new Float64Array(n);
    let CL = 0, CDi = 0, CDp = 0, maxRatio = -Infinity;
    for (let j = 0; j < n; j++) {
      G[j] = w.Sa[j] * a + w.Sb[j]; cl[j] = 2 * G[j] / w.c[j]; ai[j] = -(w.wa[j] * a + w.wb[j]);
      ratio[j] = cl[j] / w.clmax[j]; if (ratio[j] > maxRatio) maxRatio = ratio[j];
      CL += G[j] * w.dy[j]; CDi += G[j] * w.dy[j] * ai[j];
      const clc = Math.min(cl[j], w.clmax[j]);
      CDp += (w.cd0[j] + 0.0075 * (clc - 0.35) * (clc - 0.35)) * w.c[j] * w.dy[j];
    }
    CL *= 2 / w.S; CDi *= 2 / w.S; CDp /= w.S;
    const aSd = w.alphaStall / DEG;
    let post = 0, CLe = CL, CDie = CDi, CDsep = 0;
    if (alphaDeg > aSd) {
      post = alphaDeg - aSd;
      CLe = Math.max(0.55 * w.CLmax, w.CLmax * (1 - 0.03 * post));
      CDie = CL !== 0 ? CDi * (CLe / CL) * (CLe / CL) : CDi;
      CDsep = 0.018 * post + 0.0015 * post * post;
    }
    const scale = CL !== 0 ? CLe / CL : 1;
    // panelstyrker og ΔCp (for farging)
    const Gp = new Float64Array(w.NP), dCp = new Float64Array(w.NP);
    for (let p = 0; p < w.NP; p++) {
      Gp[p] = (w.Ga[p] * a + w.Gb[p]) * scale;
      const j = Math.floor(p / w.NC);
      dCp[p] = 2 * Gp[p] / (w.c[j] / w.NC);
    }
    return { alpha: alphaDeg, G, cl, ratio, ai, maxRatio, CLlin: CL, CL: CLe, CDi: CDie, CDp, CDsep, CD: CDp + CDie + CDsep + acCd0,
      post, scale, Gp, dCp, alphaInd: CLe !== 0 ? (CDie / CLe) / DEG : 0 };
  }

  function clCurve(w, from, to, step) {
    const out = [], aSd = w.alphaStall / DEG;
    for (let a = from; a <= to + 1e-9; a += step) {
      const lin = w.CLa * a * DEG + w.CLb;
      out.push([a, a > aSd ? Math.max(0.55 * w.CLmax, w.CLmax * (1 - 0.03 * (a - aSd))) : lin]);
    }
    return out;
  }

  /* ---------- Kilder: tykkelse, skrog, naceller (vingeramme, skalert) ---------- */
  function lerpSt(st, x, idx) {
    if (x <= st[0][0]) return st[0][idx];
    for (let i = 1; i < st.length; i++) if (x <= st[i][0]) { const t = (x - st[i - 1][0]) / (st[i][0] - st[i - 1][0]); return st[i - 1][idx] + t * (st[i][idx] - st[i - 1][idx]); }
    return st[st.length - 1][idx];
  }
  function fuselageAt(m, x) { // x i meter fra nesen
    const hw = lerpSt(m.st, x, 1), zt = lerpSt(m.st, x, 2), zb = lerpSt(m.st, x, 3);
    return { hw, zc: 0.5 * (zt + zb), hh: 0.5 * (zt - zb) };
  }
  function nacelleRadius(n, t) { // t 0..1 langs nacellen
    if (t < 0 || t > 1) return 0;
    if (n.fan) return n.r * (t < 0.08 ? 0.86 + t * 1.5 : t < 0.55 ? 0.98 + 0.02 * Math.sin(t * 5) : 1 - 0.6 * Math.pow((t - 0.55) / 0.45, 1.4));
    return n.r * (t < 0.18 ? Math.sqrt(t / 0.18) * 0.95 + 0.05 : t < 0.5 ? 1 : 1 - 0.75 * Math.pow((t - 0.5) / 0.5, 1.3));
  }
  function sources(w, ac) {
    const out = [], k = w.k, m = AIRCRAFT[ac].model, af = w.af;
    // vingetykkelse
    for (let j = 0; j < w.N; j++) {
      const y = w.ym[j], c = w.chord(y), xl = w.xle(y), z0 = w.zw(y);
      for (let i = 0; i < NT; i++) {
        const xa = i / NT, xb2 = (i + 1) / NT, xm = (xa + xb2) / 2;
        const Q = (thick(af, xb2) - thick(af, xa)) * c * w.dy[j];
        out.push(xl + c * xm, y, z0 + c * camber(af, xm)[0], Q, 0.6 * Math.max(c / NT, Math.abs(w.dy[j])));
      }
    }
    // skrog
    const L = m.st[m.st.length - 1][0], NB = 44, dx = L / NB;
    for (let i = 0; i < NB; i++) {
      const xa = i * dx, xb2 = (i + 1) * dx, xm = xa + dx / 2;
      const fa = fuselageAt(m, xa), fb = fuselageAt(m, xb2), fm = fuselageAt(m, xm);
      const Q = Math.PI * (fb.hw * fb.hh - fa.hw * fa.hh) * k * k;
      out.push((xm - m.xle) * k, 0, (fm.zc - m.zw) * k, Q, Math.max(0.15, 0.6 * Math.sqrt(fm.hw * fm.hh) * k));
    }
    // naceller
    for (const n of (m.nac || [])) for (const sg of [-1, 1]) {
      const yk = sg * n.y * k, x0 = w.xle(yk) + n.x0 * k, zc = w.zw(yk) + n.dz * k, NN = 16;
      for (let i = 0; i < NN; i++) {
        const ta = i / NN, tb = (i + 1) / NN, tm = (ta + tb) / 2;
        const Q = Math.PI * (Math.pow(nacelleRadius(n, tb), 2) - Math.pow(nacelleRadius(n, ta), 2)) * k * k * (n.fan ? 0.4 : 1);
        out.push(x0 + tm * n.L * k, yk, zc, Q, Math.max(0.1, 0.6 * n.r * k));
      }
    }
    return Float32Array.from(out);
  }

  /* Ikke-uniform akse med tettere noder nær fokuspunkter */
  function axis(min, max, n, foci) {
    const M = 2000, cdf = new Float64Array(M + 1);
    for (let i = 1; i <= M; i++) {
      const x = min + (max - min) * (i - 0.5) / M;
      let d = 1; for (const f of foci) d += f[2] * Math.exp(-Math.pow((x - f[0]) / f[1], 2));
      cdf[i] = cdf[i - 1] + d;
    }
    const out = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const target = cdf[M] * i / (n - 1);
      while (j < M && cdf[j + 1] < target) j++;
      const t = (target - cdf[j]) / Math.max(1e-12, cdf[j + 1] - cdf[j]);
      out[i] = min + (max - min) * Math.min(1, (j + t) / M);
    }
    out[0] = min; out[n - 1] = max;
    return out;
  }

  /* Feltkjerne: kjøres i Web Worker (selvstendig funksjon).
     Virvelbenene går langs korden til bakkanten og derfra langs vinkelen th (vingeramme) mot uendelig,
     slik at kjølvannet følger den frie strømmen i stedet for korden. Feltet regnes for to vinkler
     (WA[0], WA[1]) og blandes lineært etter α. Utdata per punkt: [a0(3), b0(3), a1(3), b1(3), kilde(3)]. */
  function fieldKernel(m) {
    const { xs, ys, zs, i0, i1, P, PT, Ga, Gb, S, core2, SL, NCc, WA } = m;
    const nyy = ys.length, nzz = zs.length, NSt = SL.length / 12, NSs = S.length / 5, FARR = 300, FPI = 1 / (4 * Math.PI);
    const out = new Float32Array((i1 - i0) * nyy * nzz * 15);
    const v = new Float64Array(3), wc = [Math.cos(WA[0]), Math.cos(WA[1])], ws = [Math.sin(WA[0]), Math.sin(WA[1])];
    const sh = new Float64Array(3), w0 = new Float64Array(3), w1 = new Float64Array(3);
    function seg(px, py, pz, ax, ay, az, bx, by, bz, o) {
      const r1x = px - ax, r1y = py - ay, r1z = pz - az, r2x = px - bx, r2y = py - by, r2z = pz - bz;
      const cx = r1y * r2z - r1z * r2y, cy = r1z * r2x - r1x * r2z, cz = r1x * r2y - r1y * r2x;
      const r0x = bx - ax, r0y = by - ay, r0z = bz - az;
      const l2 = r0x * r0x + r0y * r0y + r0z * r0z, c2 = cx * cx + cy * cy + cz * cz;
      const r1 = Math.sqrt(r1x * r1x + r1y * r1y + r1z * r1z), r2 = Math.sqrt(r2x * r2x + r2y * r2y + r2z * r2z);
      if (r1 < 1e-9 || r2 < 1e-9) return;
      const k = ((r0x * r1x + r0y * r1y + r0z * r1z) / r1 - (r0x * r2x + r0y * r2y + r0z * r2z) / r2) * FPI / (c2 + core2 * l2);
      o[0] += k * cx; o[1] += k * cy; o[2] += k * cz;
    }
    // Oppvikling (Betz): hvert frie virvelben går fra bakkanten langs den frie strømmen og trekkes gradvis mot
    // den oppviklede kjernen ved ±yc (30 % ved Lr, 70 % ved 3 Lr, 95 % ved 8 Lr). Den ytre delen av virvelflaten
    // vikles opp først (kortest Lr ved tuppen, ≈ 0,5 halvspenn); innerst er flaten nesten flat innenfor domenet.
    // Gir samme fart innover for tippvirvelen som for luften rundt den (Spreiter–Sacks: oppviklingen tar flere spenn).
    const RS = m.ROLL ? m.ROLL.s : 5, YC = m.ROLL ? m.ROLL.yc : 4;
    function leg(px, py, pz, tx, ty, tz, a, out, sgn) {
      const c = wc[a], s_ = ws[a], ay = Math.abs(ty), sy = ty < 0 ? -1 : 1;
      const Lr = RS * (0.5 + 2.6 * Math.pow(Math.max(0, 1 - ay / RS), 1.5)), d = sy * YC - ty;
      const y1 = ty + d * 0.3, y2 = ty + d * 0.7, y3 = ty + d * 0.95;
      const x1 = tx + Lr * c, z1 = tz + Lr * s_, x2 = tx + 3 * Lr * c, z2 = tz + 3 * Lr * s_, x3 = tx + 8 * Lr * c, z3 = tz + 8 * Lr * s_, x4 = tx + FARR * c, z4 = tz + FARR * s_;
      if (sgn > 0) { seg(px, py, pz, tx, ty, tz, x1, y1, z1, out); seg(px, py, pz, x1, y1, z1, x2, y2, z2, out); seg(px, py, pz, x2, y2, z2, x3, y3, z3, out); seg(px, py, pz, x3, y3, z3, x4, y3, z4, out); }
      else { seg(px, py, pz, x4, y3, z4, x3, y3, z3, out); seg(px, py, pz, x3, y3, z3, x2, y2, z2, out); seg(px, py, pz, x2, y2, z2, x1, y1, z1, out); seg(px, py, pz, x1, y1, z1, tx, ty, tz, out); }
    }
    // hesteskovirvel A-B med ben via bakkanten (ta, tb); delt del i sh, vinkelavhengig del i w0/w1
    function shoe(px, py, pz, ax, ay, az, bx, by, bz, tax, taz, tbx, tbz) {
      sh[0] = sh[1] = sh[2] = w0[0] = w0[1] = w0[2] = w1[0] = w1[1] = w1[2] = 0;
      seg(px, py, pz, tax, ay, taz, ax, ay, az, sh);
      seg(px, py, pz, ax, ay, az, bx, by, bz, sh);
      seg(px, py, pz, bx, by, bz, tbx, by, tbz, sh);
      leg(px, py, pz, tax, ay, taz, 0, w0, -1); leg(px, py, pz, tbx, by, tbz, 0, w0, 1);
      leg(px, py, pz, tax, ay, taz, 1, w1, -1); leg(px, py, pz, tbx, by, tbz, 1, w1, 1);
    }
    let o = 0;
    const acc = new Float64Array(15);
    for (let i = i0; i < i1; i++) {
      const px = xs[i];
      for (let j = 0; j < nyy; j++) {
        const py = ys[j];
        for (let l = 0; l < nzz; l++) {
          const pz = zs[l];
          acc.fill(0);
          for (let jj = 0; jj < NSt; jj++) {
            const r = 12 * jj, ddx = px - SL[r + 6], ddy = py - 0.5 * (SL[r + 1] + SL[r + 4]), ddz = pz - SL[r + 2];
            if (ddx * ddx + ddy * ddy + ddz * ddz > SL[r + 7]) {
              let ga = 0, gb = 0; for (let q = 0; q < NCc; q++) { ga += Ga[jj * NCc + q]; gb += Gb[jj * NCc + q]; }
              shoe(px, py, pz, SL[r], SL[r + 1], SL[r + 2], SL[r + 3], SL[r + 4], SL[r + 5], SL[r + 8], SL[r + 9], SL[r + 10], SL[r + 11]);
              for (let c = 0; c < 3; c++) { const a0 = sh[c] + w0[c], a1 = sh[c] + w1[c];
                acc[c] += ga * a0; acc[3 + c] += gb * a0; acc[6 + c] += ga * a1; acc[9 + c] += gb * a1; }
              continue;
            }
            for (let p = jj * NCc; p < (jj + 1) * NCc; p++) {
              const q = 6 * p, t = 4 * p;
              shoe(px, py, pz, P[q], P[q + 1], P[q + 2], P[q + 3], P[q + 4], P[q + 5], PT[t], PT[t + 1], PT[t + 2], PT[t + 3]);
              const ga = Ga[p], gb = Gb[p];
              for (let c = 0; c < 3; c++) { const a0 = sh[c] + w0[c], a1 = sh[c] + w1[c];
                acc[c] += ga * a0; acc[3 + c] += gb * a0; acc[6 + c] += ga * a1; acc[9 + c] += gb * a1; }
            }
          }
          for (let s2 = 0; s2 < NSs; s2++) {
            const q = 5 * s2, dx = px - S[q], dy = py - S[q + 1], dz = pz - S[q + 2], rc = S[q + 4];
            const r2 = dx * dx + dy * dy + dz * dz + rc * rc, f = S[q + 3] * FPI / (r2 * Math.sqrt(r2));
            acc[12] += f * dx; acc[13] += f * dy; acc[14] += f * dz;
          }
          for (let c = 0; c < 15; c++) out[o++] = acc[c];
        }
      }
    }
    return out;
  }

  root.VLab = { DEG, NC, AIRFOILS, AIRCRAFT, CONFS, atmosphere, buildWing, evaluate, clCurve, sources, axis, fieldKernel,
    camber, thick, fuselageAt, nacelleRadius, lerpSt };
  if (typeof module !== 'undefined') module.exports = root.VLab;
})(typeof window !== 'undefined' ? window : globalThis);
