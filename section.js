/* Virtual Lab – profilsnitt
   Hess–Smith panelmetode (kilde + virvel, Kutta), grensesjikt med
   Thwaites (laminært), Michel (omslag), Head (turbulent).
   Løft i stall via Kirchhoff-modell for bakkantseparasjon.
   Pedagogisk modell: trender stemmer, tall er omtrentlige. */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180, NH = 70, TWO_PI = 2 * Math.PI;
  const cfg = { hsep: 1.8, burst: 50, kdec: 0.9, slatK: 0.5, slotK: 0.5, flapK: 0.7 };   // slatK, slotK, flapK: bare høyløftmodellen (build med opt)

  const CONTAM = [
    { name: 'Ren', xtr: 2, rough: 1, th: 1 },
    { name: 'Insekter/skitt', xtr: 0.05, rough: 1.25, th: 1.4 },
    { name: 'Frost', xtr: 0.01, rough: 1.8, th: 2.2 },
    { name: 'Is på forkanten', xtr: 0.003, rough: 2.6, th: 3.4 }
  ];

  function naca(af, x) {
    const { m, p, t } = af;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
    let yc = 0, dyc = 0;
    if (m > 0) {
      if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dyc = 2 * m / (p * p) * (p - x); }
      else { yc = m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * x - x * x); dyc = 2 * m / ((1 - p) * (1 - p)) * (p - x); }
    }
    const th = Math.atan(dyc);
    return { xu: x - yt * Math.sin(th), yu: yc + yt * Math.cos(th), xl: x + yt * Math.sin(th), yl: yc - yt * Math.cos(th), yc };
  }

  /* Geometri og faktorisert likningssystem (avhenger ikke av α) */
  /* opt (valgfritt, høyløftmodell): { slat: grader, fowler: true } – lamell foran og Fowler-klaff bak. Panelmetoden løser
     flerelementprofilet som ett legeme (omhyllingen av lamell, hovedelement og klaff); spaltene modelleres i grensesjiktet
     som et nytt grensesjikt der spalten munner ut (Smiths «fresh boundary layer»-effekt), se march(). Uten opt: som før. */
  function build(af, flapDeg, opt) {
    const X = [], Y = [];
    const hl = !!opt, slat = hl ? (opt.slat || 0) : 0, fow = hl && !!opt.fowler && flapDeg > 0;
    // viskøse tap gjør klaffen mindre effektiv enn geometrien tilsier: bruk effektivt utslag (spalteklaff: litt mer effektiv)
    const fk = cfg.flapK || 0.8, flapEff = fow ? flapDeg * (flapDeg <= 20 ? fk : Math.max(0.55, fk - (flapDeg - 20) * 0.015))
      : flapDeg * (flapDeg <= 15 ? 0.8 : Math.max(0.45, 0.8 - (flapDeg - 15) * 0.02));
    const HX = 0.75, SX = 0.15;
    const ext = fow ? 0.0045 * flapDeg : 0, kf = 1 + ext / (1 - HX);       // Fowler: korden forlenges (≈ +16 % ved 35°)
    const sext = slat > 0 ? 0.03 * slat / 27 : 0, slatEff = slat * (cfg.slatK || 0.8);
    if (!hl) {
      for (let i = 0; i <= NH; i++) { const x = 0.5 * (1 + Math.cos(Math.PI * i / NH)); const q = naca(af, x); X.push(q.xl); Y.push(q.yl); }
      for (let i = 1; i <= NH; i++) { const x = 0.5 * (1 - Math.cos(Math.PI * i / NH)); const q = naca(af, x); X.push(q.xu); Y.push(q.yu); }
      if (flapDeg > 0) {
        const hx = HX, hy = naca(af, HX).yc, c = Math.cos(-flapEff * DEG), s = Math.sin(-flapEff * DEG);
        for (let i = 0; i < X.length; i++) if (X[i] > hx) {
          const dx = X[i] - hx, dy = Y[i] - hy; X[i] = hx + dx * c - dy * s; Y[i] = hy + dx * s + dy * c;
        }
      }
    } else {
      /* høyløft: omhyllingen som ett glatt legeme. Middellinjen bøyes ned foran SX (lamell) og bak HX (klaff), med
         en myk overgang (radius) så panelmetoden ikke får en kunstig sugspiss i knekken; tykkelsen legges vinkelrett
         på den nye middellinjen. Fowler-klaffen og lamellen forlenger korden (referansen er fortsatt den innfelte korden). */
      const tf = Math.tan(flapEff * DEG), ts = Math.tan(slatEff * DEG), rf = 0.06, rs = 0.05;
      const geo = x => { // x: 0..1 på det innfelte profilet → [xx, yc, dyc] på det utfelte
        const q = naca(af, x); let yc = q.yc, d = 0, xx = x;
        { const e = 1e-4, q2 = naca(af, Math.min(1, x + e)), q1 = naca(af, Math.max(0, x - e)); d = (q2.yc - q1.yc) / (Math.min(1, x + e) - Math.max(0, x - e)); }
        if (fow && x > HX - rf) { const u = x - (HX - rf), L = x > HX + rf ? u - rf : u * u / (4 * rf), dd = x > HX + rf ? 1 : u / (2 * rf);
          const k = x > HX ? kf : 1; yc -= tf * L * (x > HX ? 1 + (kf - 1) * Math.min(1, (x - HX) / (1 - HX)) : 1); d -= tf * dd; xx = x > HX ? HX + (x - HX) * k : x; }
        else if (flapDeg > 0 && !fow && x > HX) { yc -= tf * (x - HX); d -= tf; }
        if (slat > 0 && x < SX + rs) { const u = (SX + rs) - x, L = x < SX - rs ? u - rs : u * u / (4 * rs), dd = x < SX - rs ? 1 : u / (2 * rs);
          yc -= ts * L; d += ts * dd; xx = x < SX ? SX - (SX - x) * (1 + sext / SX) : xx; }
        return [xx, yc, d, q];
      };
      const pt = (x, up) => { const [xx, yc, d] = geo(x), th = Math.atan(d), q = naca({ m: 0, p: 0.4, t: af.t }, x), yt = q.yu;
        return up ? [xx - yt * Math.sin(th), yc + yt * Math.cos(th)] : [xx + yt * Math.sin(th), yc - yt * Math.cos(th)]; };
      for (let i = 0; i <= NH; i++) { const x = 0.5 * (1 + Math.cos(Math.PI * i / NH)); const p = pt(x, false); X.push(p[0]); Y.push(p[1]); }
      for (let i = 1; i <= NH; i++) { const x = 0.5 * (1 - Math.cos(Math.PI * i / NH)); const p = pt(x, true); X.push(p[0]); Y.push(p[1]); }
    }
    const slots = []; if (slat > 0) slots.push(SX); if (fow) slots.push(HX);
    const N = X.length - 1;
    const xc = new Float64Array(N), yc = new Float64Array(N), len = new Float64Array(N), cs = new Float64Array(N), sn = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      const dx = X[j + 1] - X[j], dy = Y[j + 1] - Y[j];
      len[j] = Math.hypot(dx, dy); cs[j] = dx / len[j]; sn[j] = dy / len[j];
      xc[j] = 0.5 * (X[j] + X[j + 1]); yc[j] = 0.5 * (Y[j] + Y[j + 1]);
    }
    const n1 = N + 1;
    const A = new Float64Array(n1 * n1), At = new Float64Array(N * N), Bt = new Float64Array(N), Bn = new Float64Array(N);
    const An = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let su, sv, vu, vv;
        if (i === j) { su = 0; sv = 0.5; vu = 0.5; vv = 0; }
        else {
          const dx = xc[i] - X[j], dy = yc[i] - Y[j];
          const xl = dx * cs[j] + dy * sn[j], yl = -dx * sn[j] + dy * cs[j];
          const r1 = xl * xl + yl * yl, r2 = (xl - len[j]) * (xl - len[j]) + yl * yl;
          const dth = Math.atan2(yl, xl - len[j]) - Math.atan2(yl, xl);
          const lg = Math.log(r1 / r2) / (2 * TWO_PI);
          su = lg; sv = dth / TWO_PI; vu = dth / TWO_PI; vv = -lg;
        }
        const Sx = su * cs[j] - sv * sn[j], Sy = su * sn[j] + sv * cs[j];
        const Vx = vu * cs[j] - vv * sn[j], Vy = vu * sn[j] + vv * cs[j];
        const nx = -sn[i], ny = cs[i], tx = cs[i], ty = sn[i];
        An[i * N + j] = Sx * nx + Sy * ny;
        At[i * N + j] = Sx * tx + Sy * ty;
        Bn[i] += Vx * nx + Vy * ny;
        Bt[i] += Vx * tx + Vy * ty;
      }
    }
    for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) A[i * n1 + j] = An[i * N + j]; A[i * n1 + N] = Bn[i]; }
    for (let j = 0; j < N; j++) A[N * n1 + j] = At[j] + At[(N - 1) * N + j];
    A[N * n1 + N] = Bt[0] + Bt[N - 1];
    const piv = lu(A, n1);
    let perim = 0; for (let j = 0; j < N; j++) perim += len[j];
    return { X, Y, N, xc, yc, len, cs, sn, A, piv, At, Bt, perim, af, thin: af.t < 0.05, flapEff, slatEff: slat > 0 ? slatEff : 0, slots: hl ? slots : null, slat, fowler: fow, kf, sext, HX, SX, flapDeg,
      dCdHL: hl ? 0.00012 * Math.pow(flapDeg, 1.5) + 0.0002 * slat : 0,
      // empiriske økninger i cl maks (samme som stripene i 3D-modellen, physics.js): Fowler-klaff og lamell
      dClmax: hl ? (fow ? Math.min(1.5, 0.043 * flapDeg) : 0) + Math.min(0.75, 0.027 * slat) : 0 };
  }

  function lu(A, n) {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let p = k, best = Math.abs(A[k * n + k]);
      for (let r = k + 1; r < n; r++) { const v = Math.abs(A[r * n + k]); if (v > best) { best = v; p = r; } }
      piv[k] = p;
      if (p !== k) for (let c = 0; c < n; c++) { const t = A[k * n + c]; A[k * n + c] = A[p * n + c]; A[p * n + c] = t; }
      const d = A[k * n + k];
      for (let r = k + 1; r < n; r++) {
        const f = (A[r * n + k] /= d);
        if (f !== 0) for (let c = k + 1; c < n; c++) A[r * n + c] -= f * A[k * n + c];
      }
    }
    return piv;
  }
  function luSolve(A, piv, b, n) {
    const x = Float64Array.from(b);
    for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; } }
    for (let r = 1; r < n; r++) { let s = x[r]; for (let c = 0; c < r; c++) s -= A[r * n + c] * x[c]; x[r] = s; }
    for (let r = n - 1; r >= 0; r--) { let s = x[r]; for (let c = r + 1; c < n; c++) s -= A[r * n + c] * x[c]; x[r] = s / A[r * n + r]; }
    return x;
  }

  /* Usynlig løsning ved α */
  function inviscid(g, alphaDeg) {
    const a = alphaDeg * DEG, ca = Math.cos(a), sa = Math.sin(a), N = g.N, n1 = N + 1;
    const b = new Float64Array(n1);
    for (let i = 0; i < N; i++) b[i] = -(ca * -g.sn[i] + sa * g.cs[i]);
    b[N] = -((ca * g.cs[0] + sa * g.sn[0]) + (ca * g.cs[N - 1] + sa * g.sn[N - 1]));
    const sol = luSolve(g.A, g.piv, b, n1);
    const q = sol.subarray(0, N), gam = sol[N];
    const Vt = new Float64Array(N), Cp = new Float64Array(N);
    let Mz = 0;
    for (let i = 0; i < N; i++) {
      let v = ca * g.cs[i] + sa * g.sn[i] + gam * g.Bt[i];
      for (let j = 0; j < N; j++) v += q[j] * g.At[i * N + j];
      Vt[i] = v; Cp[i] = 1 - v * v;
      const fx = Cp[i] * g.sn[i] * g.len[i], fy = -Cp[i] * g.cs[i] * g.len[i]; // −Cp·n·ds
      Mz += (g.xc[i] - 0.25) * fy - g.yc[i] * fx;
    }
    const CL = 2 * gam * g.perim;
    return { alpha: alphaDeg, q: Float64Array.from(q), gam, Vt, Cp, CL, Cm: -Mz };
  }

  /* Hastighet i et punkt (profilramme), for strømlinjer */
  function velAt(g, s, x, y, ca, sa) {
    let u = ca, v = sa;
    for (let j = 0; j < g.N; j++) {
      const dx = x - g.X[j], dy = y - g.Y[j];
      const xl = dx * g.cs[j] + dy * g.sn[j], yl = -dx * g.sn[j] + dy * g.cs[j];
      const L = g.len[j];
      const r1 = xl * xl + yl * yl, r2 = (xl - L) * (xl - L) + yl * yl;
      if (r1 < 1e-12 || r2 < 1e-12) continue;
      const dth = Math.atan2(yl, xl - L) - Math.atan2(yl, xl);
      const lg = Math.log(r1 / r2) / (2 * TWO_PI);
      const lu_ = s.q[j] * lg + s.gam * dth / TWO_PI;
      const lv = s.q[j] * dth / TWO_PI - s.gam * lg;
      u += lu_ * g.cs[j] - lv * g.sn[j];
      v += lu_ * g.sn[j] + lv * g.cs[j];
    }
    return [u, v];
  }

  /* Grensesjikt langs én side fra stagnasjonspunktet */
  function H1ofH(H) { return H <= 1.6 ? 3.3 + 0.8234 * Math.pow(H - 1.1, -1.287) : 3.3 + 1.5501 * Math.pow(H - 0.6778, -3.064); }
  function HofH1(H1) {
    if (H1 <= 3.32) return 3.0;
    return H1 >= 5.3 ? 1.1 + Math.pow((H1 - 3.3) / 0.8234, -1 / 1.287) : 0.6778 + Math.pow((H1 - 3.3) / 1.5501, -1 / 3.064);
  }

  function march(pts, Re, ct, noSep, slots) {
    const nu = 1 / Re, n = pts.length;
    const out = { pts: [], xtr: null, xsep: null, bubble: null, burst: false, end: null };
    let I = 0, mode = 'L', th = 0, H = 2.6, Y = 0, si = 0;
    if (slots) out.slots = [];
    for (let m = 0; m < n; m++) {
      const p = pts[m], ue = Math.max(p.ue, 1e-4);
      /* spalte: luft med høy energi fra undersiden strømmer ut over neste element og starter et nytt, tynt grensesjikt
         (kjølvannet fra elementet foran blander seg inn, så ikke helt fra null) */
      if (slots && si < slots.length && m > 0 && p.u && pts[m - 1].u && pts[m - 1].x < slots[si] && p.x >= slots[si]) {
        si++; out.slots.push(p.x);
        if (mode === 'L') { mode = 'T'; out.xtr = out.xtr == null ? p.x : out.xtr; }
        th = Math.max(th * (cfg.slotK || 0.3), 2e-5); H = 1.45; Y = ue * th * H1ofH(H);
      }
      const ds = m ? p.s - pts[m - 1].s : 0;
      let due;
      if (m === 0) due = (pts[1].ue - pts[0].ue) / (pts[1].s - pts[0].s);
      else if (m === n - 1) due = (p.ue - pts[m - 1].ue) / ds;
      else due = (pts[m + 1].ue - pts[m - 1].ue) / (pts[m + 1].s - pts[m - 1].s);

      if (mode === 'L') {
        const u0 = m ? Math.max(pts[m - 1].ue, 0) : 0;
        I += 0.5 * (Math.pow(u0, 5) + Math.pow(ue, 5)) * (m ? ds : p.s);
        const th2 = 0.45 * nu * I / Math.pow(ue, 6);
        th = Math.sqrt(th2);
        const lam = Math.max(-0.1, Math.min(0.25, th2 * due / nu));
        H = lam >= 0 ? 2.61 - 3.75 * lam + 5.24 * lam * lam : 2.088 + 0.0731 / (lam + 0.14);
        const Rex = ue * p.s / nu, Rth = ue * th / nu;
        const michel = Rex > 1e3 && Rth > 1.174 * (1 + 22400 / Rex) * Math.pow(Rex, 0.46);
        const forced = p.x >= ct.xtr && p.s > 0;
        const lamSep = m > 2 && th2 * due / nu < -0.09;
        if (lamSep) {
          if (!noSep && (Rth < cfg.burst || p.x > 0.9)) {           // boblen sprekker: laminær stall
            out.burst = Rth < cfg.burst; out.xsep = p.x; out.pts.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, u: p.u, d: 7.5 * th, r: 'S' }); out.end = m; break;
          }
          // kort laminær boble: gjenfester etter Re_l ≈ 4·10⁴ (Horton/Owen–Klanfer)
          out.bubble = p.x; out.bubbleLen = Math.min(0.3, 4e4 / (Re * ue)); out.xtr = p.x; mode = 'T'; th *= 1.6; H = 1.6; Y = ue * th * H1ofH(H);
        } else if (michel || forced) {
          out.xtr = p.x; mode = 'T'; th *= (forced && !michel ? ct.th : 1); H = 1.4; Y = ue * th * H1ofH(H);
        }
        out.pts.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, u: p.u, d: mode === 'L' ? 7.5 * th : th * (3.15 + 1.72 / (H - 1)) + H * th, r: mode === 'L' ? 'L' : 'T' });
        continue;
      }
      // turbulent (Head)
      const u0 = pts[m - 1].ue, dd = (ue - u0) / ds, sub = 6, h = ds / sub;
      for (let k = 0; k < sub; k++) {
        const u = Math.max(u0 + dd * (k + 0.5) * h, 1e-4);
        const Rth = Math.max(u * th / nu, 100);
        const Cf = ct.rough * 0.246 * Math.pow(10, -0.678 * H) * Math.pow(Rth, -0.268);
        const H1 = Y / (u * th);
        const F = 0.0306 * Math.pow(Math.max(H1 - 3, 0.01), -0.6169);
        th += (Cf / 2 - (H + 2) * th / u * dd) * h;
        Y += u * F * h;
        th = Math.max(th, 1e-7);
        H = HofH1(Y / (u * th));
      }
      const d = th * (3.15 + 1.72 / Math.max(H - 1, 0.05)) + H * th;
      if (!noSep && H >= cfg.hsep && p.x < 0.98) {
        out.xsep = p.x; out.pts.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, u: p.u, d, r: 'S' }); out.end = m; break;
      }
      out.pts.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, u: p.u, d, r: 'T' });
    }
    const last = out.pts.length ? pts[Math.min(n - 1, out.end == null ? n - 1 : out.end)] : pts[n - 1];
    out.th = th; out.H = Math.min(H, 2.5); out.ue = Math.max(last.ue, 0.2);
    return out;
  }

  function viscous(g, inv, Re, contamIdx) {
    const ct = CONTAM[contamIdx], N = g.N, Vt = inv.Vt;
    let k = -1;
    if (g.slots) { let bx = 1e9; for (let i = 1; i < N; i++) if (Vt[i - 1] < 0 && Vt[i] >= 0 && g.xc[i] < bx) { bx = g.xc[i]; k = i; } }   // høyløft: nærmest forkanten (ikke i klaffens kove)
    else for (let i = 1; i < N; i++) if (Vt[i - 1] < 0 && Vt[i] >= 0) { k = i; break; }
    if (k < 0) k = NH;
    const t = -Vt[k - 1] / (Vt[k] - Vt[k - 1]);
    const dk = Math.hypot(g.xc[k] - g.xc[k - 1], g.yc[k] - g.yc[k - 1]);
    const stag = { x: g.xc[k - 1] + t * (g.xc[k] - g.xc[k - 1]), y: g.yc[k - 1] + t * (g.yc[k] - g.yc[k - 1]) };
    const side = (dir) => {
      const pts = []; let s = 0, i = dir > 0 ? k : k - 1, prev = null;
      s = dir > 0 ? (1 - t) * dk : t * dk;
      for (; i >= 0 && i < N; i += dir) {
        if (prev !== null) s += Math.hypot(g.xc[i] - g.xc[prev], g.yc[i] - g.yc[prev]);
        pts.push({ s, ue: dir * Vt[i], x: g.xc[i], y: g.yc[i], nx: -g.sn[i], ny: g.cs[i], u: i >= NH });
        prev = i;
      }
      return march(pts, Re, ct, g.thin, dir > 0 && g.slots && g.slots.length ? g.slots : null);
    };
    const up = side(1), lo = side(-1);
    if (g.thin) {
      // tynn plate: skarp forkant gir lang boble og tidlig forkantstall (empirisk)
      const aa = Math.abs(inv.alpha), ff = aa < 6 ? 1 : Math.max(0.03, 1 - Math.pow((aa - 6) / 6, 1.5));
      const sd = inv.alpha >= 0 ? up : lo;
      if (ff < 0.98) { sd.xsep = ff; sd.pts = sd.pts.filter(q => q.x <= ff); if (sd.pts.length) sd.pts[sd.pts.length - 1].r = 'S'; }
      if (aa > 2) { sd.bubble = 0.01; }
    }
    const fu = up.xsep == null ? 1 : Math.min(1, up.xsep);
    const fl = lo.xsep == null ? 1 : Math.min(1, lo.xsep);
    let f = inv.CL >= 0 ? fu : fl, hlStall = 0;
    /* Høyløft: grensesjiktet over flerelementprofilet (spaltene gir nytt grensesjikt) holder seg festet langt forbi det
       virkelige stallpunktet, fordi panelmetoden ikke ser lamellens og hovedelementets egne trykkfordelinger. Stallgrensen
       settes derfor fra det rene profilets cl maks (samme grensesjiktmodell, samme Re og forkant) pluss empiriske økninger
       for klaff og lamell (dClmax). Når løftet med festet strømning nærmer seg grensen, flyttes separasjonen fram. */
    if (g.slots && g.dClmax > 0 && inv.CL > 0) {
      const lim = cleanMax(g.af, Re, contamIdx) + g.dClmax, att = cfg.kdec * inv.CL * Math.pow((1 + Math.sqrt(Math.max(f, 0.75))) / 2, 2), r = att / lim;
      let fs = 1;
      if (r > 1) fs = Math.max(0.12, 0.62 - 2.6 * (r - 1)); else if (r > 0.96) fs = 1 - 0.38 * Math.pow((r - 0.96) / 0.04, 2);
      if (fs < f) { f = fs; hlStall = r;
        up.xsep = fs; up.burst = false; up.pts = up.pts.filter(q => !q.u || q.x <= fs); const lp = up.pts[up.pts.length - 1]; if (lp) lp.r = 'S'; }
    }
    const kir = Math.pow((1 + Math.sqrt(Math.max(f, 0))) / 2, 2);
    const CL = cfg.kdec * inv.CL * kir;
    const sy = b => 2 * b.th * Math.pow(b.ue, (b.H + 5) / 2);
    const a = inv.alpha * DEG;
    const Cd = sy(up) + sy(lo) + 2.0 * (1 - f) * Math.sin(a) * Math.sin(a) + (g.dCdHL || 0);
    const cpAtt = Math.abs(inv.CL) > 0.02 ? 0.25 - inv.Cm / inv.CL : 0.25;
    const cp = Math.max(0, Math.min(1, cpAtt + (1 - f) * (0.45 - cpAtt)));
    return { up, lo, stag, f, CL, Cd, cp, hlStall, Cm: inv.Cm * (0.6 + 0.4 * kir) - (1 - f) * 0.1 * Math.abs(CL) };
  }

  /* cl maks for det rene profilet (memo per profil, Re og forkant): grunnlaget for stallgrensen med høyløft */
  const CMX = new Map(), CG = new Map();
  function cleanMax(af, Re, contamIdx) {
    const key = af.name + '|' + Math.round(Math.log10(Re) * 50) + '|' + contamIdx; let v = CMX.get(key);
    if (v == null) { let g0 = CG.get(af.name); if (!g0) { g0 = build(af, 0); CG.set(af.name, g0); }
      v = polar(g0, Math.pow(10, Math.round(Math.log10(Re) * 50) / 50), contamIdx, 0, 26, 0.5).CLmax; if (CMX.size > 64) CMX.clear(); CMX.set(key, v); }
    return v;
  }
  /* Polar over α-område: kritisk vinkel og CL maks */
  function polar(g, Re, contamIdx, from, to, step) {
    const out = [];
    let best = { a: 0, cl: -Infinity };
    for (let a = from; a <= to + 1e-9; a += step) {
      const inv = inviscid(g, a), v = viscous(g, inv, Re, contamIdx);
      out.push({ a, cl: v.CL, cli: inv.CL, cd: v.Cd });
      if (a >= 0 && v.CL > best.cl && !best.done) best = { a, cl: v.CL };
      else if (a >= 0 && best.cl > 0 && v.CL < best.cl - 0.005) best.done = true;
    }
    return { pts: out, alphaCrit: best.a, CLmax: best.cl };
  }

  function sutherland(T) { return 1.458e-6 * Math.pow(T, 1.5) / (T + 110.4); }

  root.VSection = { cfg, CONTAM, build, inviscid, viscous, polar, velAt, sutherland, naca, cleanMax };
  if (typeof module !== 'undefined') module.exports = root.VSection;
})(typeof window !== 'undefined' ? window : globalThis);
