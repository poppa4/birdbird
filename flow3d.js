/* Virtual Lab – strømlinjer i 3D (delt av hovedtråden og en egen Web Worker)
   Hastighetsfeltet kommer fra virvelgitteret i physics.js (hesteskovirvler med oppviklet kjølvann,
   kilder for tykkelse, skrog og motorgondoler) og er forhåndsberegnet på et ikke-uniformt rutenett.
   Her: trilineær oppslag, kollisjon mot vinge/skrog/gondoler, separert sone, RK4-integrasjon,
   krysstrømsplan (virvlighet ωx) og Cp på overflaten.
   Koordinater: vingeramme x bak, y høyre, z opp; spenn = 10. */
(function (root) {
  'use strict';
  const DEG = Math.PI / 180;

  function make(P) {
    let wing = null, res = null, G = null, FT = null;
    const F = { data: null, xs: null, ys: null, zs: null, nx: 0, ny: 0, nz: 0, wt: 0, wa: [0, 14 * DEG] };
    const B = { px: 0, py: 0, x0: -9, x1: 25, y0: -4.2, y1: 4.8, z: 8 };   // grenser i verdensrammen (tunnel eller CFD-domene)

    function bin(ax, v) { const n = ax.length; if (v < ax[0] || v > ax[n - 1]) return -1; let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ax[m] > v) hi = m; else lo = m; } return lo; }
    /* forstyrrelseshastighet (uten fri strøm) i punktet; A = α i radianer, sc = skalering etter stall */
    function fieldAt(x, y, z, A, sc, out) {
      out[0] = out[1] = out[2] = 0; if (!F.data) return;
      const sy = y < 0 ? -1 : 1, yy = Math.abs(y), i = bin(F.xs, x), j = bin(F.ys, yy), l = bin(F.zs, z);
      if (i < 0 || j < 0 || l < 0) return;
      const tx = (x - F.xs[i]) / (F.xs[i + 1] - F.xs[i]), ty = (yy - F.ys[j]) / (F.ys[j + 1] - F.ys[j]), tz = (z - F.zs[l]) / (F.zs[l + 1] - F.zs[l]);
      const d = F.data, ny = F.ny, nz = F.nz, t1 = F.wt, t0 = 1 - t1;
      for (let c = 0; c < 8; c++) {
        const di = c & 1, dj = (c >> 1) & 1, dl = (c >> 2) & 1;
        const wgt = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dl ? tz : 1 - tz); if (wgt === 0) continue;
        const b = (((i + di) * ny + (j + dj)) * nz + (l + dl)) * 15;
        for (let q = 0; q < 3; q++) out[q] += wgt * ((A * (t0 * d[b + q] + t1 * d[b + 6 + q]) + (t0 * d[b + 3 + q] + t1 * d[b + 9 + q])) * sc + d[b + 12 + q]);
      }
      out[1] *= sy;
    }

    /* ---- rask sampler for partikler (røyk): feltet blandet ferdig for gjeldende α, kjølvannsvinkel og stallskalering
       (3 tall per node i stedet for 15) og oppslagstabeller for indeksene i de ikke-uniforme aksene (ingen binærsøk).
       Samme trilineære interpolasjon som fieldAt, så verdiene er identiske. */
    const FB = { v: null, key: '', lx: null, ly: null, lz: null };
    function lut(ax) {
      const n = ax.length, R = 2048, a0 = ax[0], inv = R / (ax[n - 1] - a0), t = new Uint16Array(R + 1);
      let i = 0; for (let k = 0; k <= R; k++) { const v = a0 + k / inv; while (i < n - 2 && ax[i + 1] <= v) i++; t[k] = i; }
      return { t, a0, inv, R, ax, n };
    }
    function ensureBlend(A, sc) {
      if (!F.data) return false;
      const key = A + ':' + F.wt + ':' + sc + ':' + F.nx + ':' + F.data.length;
      if (FB.key === key && FB.d === F.data) return true;
      const N = F.nx * F.ny * F.nz, d = F.data, t1 = F.wt, t0 = 1 - t1;
      if (!FB.v || FB.v.length !== N * 3) FB.v = new Float32Array(N * 3);
      const v = FB.v;
      for (let n = 0, b = 0; n < N; n++, b += 15) for (let q = 0; q < 3; q++)
        v[n * 3 + q] = (A * (t0 * d[b + q] + t1 * d[b + 6 + q]) + (t0 * d[b + 3 + q] + t1 * d[b + 9 + q])) * sc + d[b + 12 + q];
      if (FB.xs !== F.xs) { FB.lx = lut(F.xs); FB.ly = lut(F.ys); FB.lz = lut(F.zs); FB.xs = F.xs; }
      FB.key = key; FB.d = F.data; return true;
    }
    function li(L, v) { // indeks i aksen, −1 utenfor
      if (v < L.a0) return -1; const k = ((v - L.a0) * L.inv) | 0; if (k > L.R) return -1;
      let i = L.t[k]; const ax = L.ax; while (i < L.n - 2 && ax[i + 1] <= v) i++; return v > ax[L.n - 1] ? -1 : i;
    }
    /* forstyrrelseshastighet fra det blandede feltet (krever ensureBlend for samme α først) */
    function fieldFast(x, y, z, out) {
      out[0] = out[1] = out[2] = 0;
      const sy = y < 0 ? -1 : 1, yy = y < 0 ? -y : y, i = li(FB.lx, x), j = li(FB.ly, yy), l = li(FB.lz, z);
      if (i < 0 || j < 0 || l < 0) return;
      const xs = F.xs, ys = F.ys, zs = F.zs, tx = (x - xs[i]) / (xs[i + 1] - xs[i]), ty = (yy - ys[j]) / (ys[j + 1] - ys[j]), tz = (z - zs[l]) / (zs[l + 1] - zs[l]);
      const v = FB.v, ny = F.ny, nz = F.nz, sx = ny * nz * 3, sY = nz * 3;
      const b = ((i * ny + j) * nz + l) * 3, ux = 1 - tx, uy = 1 - ty, uz = 1 - tz;
      const w000 = ux * uy * uz, w100 = tx * uy * uz, w010 = ux * ty * uz, w110 = tx * ty * uz, w001 = ux * uy * tz, w101 = tx * uy * tz, w011 = ux * ty * tz, w111 = tx * ty * tz;
      for (let q = 0; q < 3; q++) {
        const o = b + q;
        out[q] = w000 * v[o] + w100 * v[o + sx] + w010 * v[o + sY] + w110 * v[o + sx + sY] + w001 * v[o + 3] + w101 * v[o + sx + 3] + w011 * v[o + sY + 3] + w111 * v[o + sx + sY + 3];
      }
      out[1] *= sy;
    }

    /* ---- geometri (samme som modellen i 3D-scenen) ---- */
    const visTf = ly => wing.tf ? wing.tf(ly) : 1.32 - 0.32 * Math.min(1, Math.abs(ly) / wing.s);
    function wingZ(ly, xx, c, upper, off) {
      const w = wing; let zc = w.zw(ly) + c * P.camber(w.af, xx)[0];
      if (G.flapDeg > 0 && Math.abs(ly) <= w.fs && xx > 0.75) zc -= (xx - 0.75) * c * Math.tan(G.flapDeg * DEG);
      if (G.slatDeg > 0 && Math.abs(ly) >= w.slFrom && xx < 0.14) { const u = (0.14 - xx) / 0.14; zc -= Math.tan(G.slatDeg * DEG) * 0.14 * c * u * u; }
      zc -= (xx - 0.25) * c * Math.tan(G.twist * DEG * Math.abs(ly) / w.s);
      const ht = 0.5 * c * P.thick(w.af, xx) * visTf(ly) + off * c; return upper ? zc + ht : zc - ht;
    }
    function wingSurf(ly, xc, upper, off) { const w = wing, c = w.chord(ly), xx = Math.max(0, Math.min(1, xc)); return [w.xle(ly) + c * xx, wingZ(ly, xx, c, upper, off || 0)]; }
    function stripAt(ly) { const w = wing; return Math.min(w.N - 1, Math.max(0, Math.floor(w.N * Math.acos(Math.max(-1, Math.min(1, -ly / w.s))) / Math.PI))); }
    /* separasjonspunkt på oversiden per stripe (andel av korden) – samme logikk som profilsnittet */
    function sepFrac(j) {
      if (!res) return 1; const r = res.ratio[j], thin = P.AIRFOILS[G.af].t < 0.05;
      /* on: stallmargin der bakkantseparasjonen starter (0,86 med ren forkant; tidligere med ruhet/is, se applyLE) */
      const on = G && G.leOn ? G.leOn : 0.86;
      /* utfelt spoiler: strømningen løsner fra panelets bakkant (≈ 66 % korde) og danner en separert sone til bakkanten */
      const sp = wing.spMask && wing.spMask[j] && wing.spDeg > 4 ? 0.66 : 1;
      if (r >= 1) return thin ? 0.03 : Math.min(sp, Math.max(0.03, 0.68 - 1.5 * (r - 1)));
      if (r > on) return Math.min(sp, thin ? 1 : 1 - 0.32 * Math.pow((r - on) / (1 - on), 2));
      return sp;
    }
    /* Cp på vingeflaten per stripe fra virvelgitteret (ΔCp per panel) pluss tykkelsesbidrag; samme som fargene på vingen.
       Over separasjonspunktet: trykkplatå. x = andel av korden, up = oversiden. */
    function stripCp(j, x, up) {
      const NC = wing.NC, af = P.AIRFOILS[G.af], xc0 = 0.5 / NC, xcl = (NC - 0.5) / NC, d0 = res.dCp;
      const at = xx => { if (xx <= xc0) return d0[j * NC] * (1 + 1.4 * (xc0 - xx) / xc0);
        if (xx >= xcl) return d0[j * NC + NC - 1] * (1 - xx) / (1 - xcl);
        const f = xx * NC - 0.5, q = Math.floor(f), t = f - q; return d0[j * NC + q] * (1 - t) + d0[j * NC + q + 1] * t; };
      const tj = wing.tAt ? wing.tAt(wing.ym[j]) : af.t;
      const xs = sepFrac(j), d = at(x), tt = 2.2 * tj * Math.sqrt(Math.max(x, 0)) * (1 - x);
      if (up) { let cp = -d / 2 - tt;
        if (xs < 1 && x > xs) { const cs = -at(xs) / 2 - 2.2 * tj * Math.sqrt(xs) * (1 - xs); cp = Math.max(-1.1, Math.min(-0.25, cs * 0.75)); }
        if (xs < 0.1 && x < 0.08) cp = Math.max(cp, -1.2); return cp; }
      return Math.min(1, d / 2 - tt + (x < 0.02 ? (1 - x / 0.02) * 0.7 : 0));
    }
    /* Nærfelt ved vingen: rutenettet glatter ut spranget i hastighet over virvelflaten (sug over, stagnasjon ved
       forkanten). Innenfor et tynt lag (~0,16 c) blandes hastigheten mot flatens tangent med farten som svarer til
       stripens Cp (V/V∞ = √(1 − Cp)), slik at linjene nær flaten har samme fart som fargene på vingen. */
    function nearWall(X, Y, Z, v, ex) {
      const w = wing; if (Math.abs(Y) >= w.s * 0.995) return;
      const c = w.chord(Y), xc = (X - w.xle(Y)) / c; if (xc < -0.08 || xc > 1.1) return;
      const xx = xc < 0 ? 0 : xc > 1 ? 1 : xc, zu = wingZ(Y, xx, c, true, 0), zl = wingZ(Y, xx, c, false, 0);
      const up = Z >= 0.5 * (zu + zl), d = Math.max(0, up ? Z - zu : zl - Z), del = 0.16 * c; if (d > 4 * del) return;
      const j = stripAt(Y); if (up && xx > sepFrac(j) - 0.02) return;
      let wg = Math.exp(-d / del); if (xc < 0) wg *= 1 + xc / 0.08; if (xc > 1) wg *= 1 - (xc - 1) / 0.1; if (wg <= 0.002) return;
      const cp = stripCp(j, xx, up), Vs = Math.max(0.2, 1 + (Math.sqrt(Math.max(0, 1 - cp)) - 1) * ex);
      const h = 0.012, xa = Math.max(0, xx - h), xb = Math.min(1, xx + h), dz = (wingZ(Y, xb, c, up, 0) - wingZ(Y, xa, c, up, 0)) / ((xb - xa) * c), L = Math.hypot(1, dz);
      v[0] += wg * (Vs / L - v[0]); v[2] += wg * (Vs * dz / L - v[2]);
    }
    /* Tippvirvelens kjerne. Rutenettet (celler ~0,2–0,3) smører ut den oppviklede kjernen, så virvelen ser svakere
       ut enn den er. Langs modellens egen oppviklingsbane (samme som de ytterste frie virvelbena) legges en
       Lamb–Oseen-kjerne inn igjen: Δv_θ = Γc/(2πr)·[exp(−r²/rg²) − exp(−r²/rc²)], der rg er utsmøringsradien i
       rutenettet og rc den fysiske kjerneradien. Korreksjonen har null nettosirkulasjon langt ute (ingen dobbelttelling).
       Γc(x) er bunden sirkulasjon ved y*, der y* er innerste stripe hvis virvelben har nådd kjernen ved x (Betz). */
    let CORE = null;
    function buildCore() {
      const w = wing, s = w.s, YC = 0.86 * s, th = F.wa[0] + F.wt * (F.wa[1] - F.wa[0]), tt = Math.tan(th);
      // samme bane som de frie virvelbena i physics.js (fieldKernel → leg): 30 % ved Lr, 70 % ved 3 Lr, 95 % ved 8 Lr
      const TE = y => w.xle(y) + w.chord(y), Lr = y => s * (0.5 + 2.6 * Math.pow(Math.max(0, 1 - y / s), 1.5));
      const join = y => TE(y) + 2 * Lr(y), xT = TE(s), zT = w.zw(s), Lr0 = Lr(s), ct = w.chord(s);
      const Gy = y => { const j = stripAt(y); return Math.max(0, res.G[j] * res.scale); };
      const n = 96, x0 = xT - 0.6 * ct, x1 = xT + 32, X = new Float32Array(n), Yc = new Float32Array(n), Zc = new Float32Array(n), Gc = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = x0 + (x1 - x0) * i / (n - 1), u = Math.max(0, x - xT);
        const f = u < Lr0 ? 0.3 * u / Lr0 : u < 3 * Lr0 ? 0.3 + 0.4 * (u - Lr0) / (2 * Lr0) : u < 8 * Lr0 ? 0.7 + 0.25 * (u - 3 * Lr0) / (5 * Lr0) : 0.95;
        let lo = 0, hi = s; if (join(0) <= x) hi = 0; else if (join(s) > x) lo = s; else for (let k = 0; k < 30; k++) { const m = 0.5 * (lo + hi); if (join(m) <= x) hi = m; else lo = m; }
        const ys = 0.5 * (lo + hi), gm = ys >= s ? 0 : Gy(ys), ramp = Math.max(0, Math.min(1, (x - x0) / (xT + 1 - x0)));
        X[i] = x; Yc[i] = s + (YC - s) * f; Zc[i] = zT + u * tt; Gc[i] = Math.max(gm, Gy(0.85 * s) * ramp * ramp * (3 - 2 * ramp));
      }
      // utsmøringsradius i rutenettet ved kjernen
      let rg = 0.32; if (F.ys) { const j = bin(F.ys, YC), l = bin(F.zs, zT + 3 * tt); if (j >= 0 && l >= 0) rg = Math.max(0.28, 1.25 * Math.max(F.ys[j + 1] - F.ys[j], F.zs[l + 1] - F.zs[l])); }
      CORE = { x0, x1, n, X, Yc, Zc, Gc, rg2: rg * rg, rc2: 0.11 * 0.11, rw2: 0.7 * 0.7, key: res.alpha + ':' + F.wt + ':' + res.scale };
      return CORE;
    }
    /* full = true (strømlinjer, fartssnitt): nær kjernen (r ≲ 0,6, vekt exp(−(r/R)⁴), R = 0,7) erstattes tverrfarten fra rutenettet
       helt av modellens egen oppviklede virvel: kjernens drift langs oppviklingsbanen (kjernen er en materiell linje) pluss
       en Lamb–Oseen-virvel med samme sirkulasjon Γc. Rutenettet blander feltet for to kjølvannsvinkler lineært, så den
       utsmurte virvelen ligger delt mellom to baner og ikke på banen; uten dette driver linjene ut av virvelen i stedet
       for å vikle seg rundt den. Langt ute (vekt → 0) er feltet urørt. */
    function coreSwirl(X, Y, Z, v, ex, full) {
      const C = CORE; if (!C || X < C.x0) return;
      const t = Math.min(C.n - 1.001, (X - C.x0) / (C.x1 - C.x0) * (C.n - 1)), i = t | 0, u = t - i;
      const yc = C.Yc[i] + (C.Yc[i + 1] - C.Yc[i]) * u, zc = C.Zc[i] + (C.Zc[i + 1] - C.Zc[i]) * u, G = C.Gc[i] + (C.Gc[i + 1] - C.Gc[i]) * u;
      const sg = Y < 0 ? -1 : 1, dy = Y - sg * yc, dz = Z - zc, r2 = dy * dy + dz * dz;
      const lim = full ? Math.max(9 * C.rg2, 3 * C.rw2) : 9 * C.rg2;
      if (r2 > lim || r2 < 1e-10) return;
      const k = sg * ex * G / (2 * Math.PI * r2) * (Math.exp(-r2 / C.rg2) - Math.exp(-r2 / C.rc2));
      let vy = v[1] - dz * k, vz = v[2] + dy * k;
      if (full && ex > 0 && G > 1e-4) {
        const q = r2 / C.rw2, wg = Math.exp(-q * q);   // flat nær kjernen, faller av rundt r ≈ 0,7
        const dX = (C.x1 - C.x0) / (C.n - 1), syc = (C.Yc[i + 1] - C.Yc[i]) / dX, szc = (C.Zc[i + 1] - C.Zc[i]) / dX, u0 = v[0];
        const kl = sg * ex * G / (2 * Math.PI * r2) * (1 - Math.exp(-r2 / C.rc2));
        vy += wg * (sg * syc * u0 - dz * kl - vy); vz += wg * (szc * u0 + dy * kl - vz);
      }
      v[1] = vy; v[2] = vz;
    }
    function ensureCore() { if (!res || !wing) return; const key = res.alpha + ':' + F.wt + ':' + res.scale; if (!CORE || CORE.key !== key || CORE.w !== wing) { buildCore(); CORE.w = wing; } }
    function buildFusTab(m) {
      const k = wing.k, L = m.st[m.st.length - 1][0], n = 400, hw = new Float32Array(n + 1), hh = new Float32Array(n + 1), zc = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) { const f = P.fuselageAt(m, L * i / n); hw[i] = f.hw * k * 1.05 + 0.02; hh[i] = f.hh * k * 1.05 + 0.02; zc[i] = (f.zc - m.zw) * k; }
      const nac = (m.nac || []).flatMap(nn => [-1, 1].map(sg => { const yk = sg * nn.y * k, x0 = wing.xle(yk) + nn.x0 * k, Lk = nn.L * k, R = new Float32Array(65); for (let i = 0; i <= 64; i++) R[i] = P.nacelleRadius(nn, i / 64) * k + 0.02; return { yk, x0, Lk, R, zc: wing.zw(yk) + nn.dz * k }; }));
      FT = { x0: -m.xle * k, len: L * k, n, hw, hh, zc, nac };
    }
    /* separert område bak separasjonspunktet: død luft mellom flaten og skjærlaget, kjølvann bak bakkanten */
    const DZ = { top: 0, bot: 0, amp: 0, inside: false };
    function deadZone(lx, ly, lz) {
      DZ.inside = false; DZ.amp = 0; const w = wing, ay = Math.abs(ly);
      if (ay > w.s * 0.995 || !res) return DZ;
      const j = stripAt(ly), xs = sepFrac(j); if (xs > 0.97) return DZ;
      const c = w.chord(ly), al = Math.tan(res.alpha * DEG), sev = Math.min(1, (1 - xs) * 2.2);
      const [Xs, Zs] = wingSurf(ly, xs, true, 0.012), [Xt, Zt] = wingSurf(ly, 1, true, 0.0);
      if (lx < Xs - 0.02) return DZ;
      const Lw = c * (0.8 + 2.4 * (1 - xs)), dx = lx - Xs;
      const top = Zs + dx * (al + 0.05), bot0 = lx <= Xt ? wingZ(ly, Math.min(1, (lx - w.xle(ly)) / c), c, true, 0.012) : Zt + (lx - Xt) * (al - 0.05);
      const ff = lx <= Xt ? 0 : Math.min(1, (lx - Xt) / Lw), topC = top - (top - bot0) * ff * ff;
      DZ.top = topC; DZ.bot = bot0;
      if (lz < topC && lz > bot0 && ff < 1) DZ.inside = true;
      const zc = 0.5 * (top + bot0), hw = 0.5 * (top - bot0) + 0.06 * dx, d = Math.abs(lz - zc) - hw, band = 0.08 * c + 0.1 * dx;
      const prox = d <= 0 ? 1 : Math.max(0, 1 - d / band);
      DZ.amp = prox * sev * c * (0.035 + 0.11 * Math.min(1.6, dx / c));
      return DZ;
    }
    /* Kjølvann bak bakkanten ved festet strømning (profilmotstanden): gaussisk hastighetsunderskudd med samme impulstap som
       stripens profilmotstand, ∫u_d dz = cd·c/2 ⇒ u_d/V∞ = cd·c/(2√π·b), halvbredde b = √(b0² + 0.09·cd·c·Δx), b0 = 0,015c
       (fjernkjølvann-likhet, b ∝ √(cd·c·x)). Senterlinjen følger lokal strømretning (α − ε, samme vinkel som de frie virvlene).
       WK.def = underskudd (andel av V∞), WK.ti = turbulensintensitet ≈ 0,3·underskuddet (kjølvannet er turbulent fordi grensesjiktet
       har slått om før bakkanten ved disse Reynolds-tallene). */
    const WK = { def: 0, ti: 0 };
    function attachedWake(lx, ly, lz) {
      WK.def = 0; WK.ti = 0; const w = wing, ay = Math.abs(ly); if (!res || ay >= w.s * 0.99) return WK;
      const c = w.chord(ly), xT = w.xle(ly) + c, dx = lx - xT; if (dx < -0.02 * c || dx > 40) return WK;
      const j = stripAt(ly), cl = Math.min(res.cl[j] * res.scale, w.clmax[j]), cd = w.cd0[j] + 0.0075 * (cl - 0.35) * (cl - 0.35);
      const th = F.wa[0] + F.wt * (F.wa[1] - F.wa[0]), zc = w.zw(ly) + Math.max(0, dx) * Math.tan(th) - 0.02 * c * Math.min(1, Math.max(0, dx) / c);
      const b = Math.sqrt(0.000225 * c * c + 0.09 * cd * c * Math.max(0, dx)), u = (lz - zc) / b;
      if (u * u > 16) return WK;
      const tipF = Math.min(1, (w.s - ay) / (0.06 * w.s));
      WK.def = tipF * cd * c / (2 * 1.7725 * b) * Math.exp(-u * u) * Math.min(1, (dx + 0.02 * c) / (0.04 * c));
      WK.ti = 0.3 * WK.def; return WK;
    }
    /* Propellstrøm (aktuatorskive, se physics.actuatorDisc): aksial tilleggsfart Δu(ξ) = a·(1 + ξ/√(ξ² + R²)) innenfor strålens radius
       R(ξ) = R·√((1 + a)/(1 + Δu)), radiell innstrømming fra kontinuiteten v_r = −(r/2)·dΔu/dξ, og rotasjon vθ = K/r (fast legeme innenfor
       navet). Strålens akse følger den frie strømmen fra skiven (vingerammen: (cos α, sin α)). Rotasjon med klokka sett bakfra: toppen
       går mot flyets høyre side (−y i vingerammen). SLIP.p: [{c:[x,y,z], R, a, K, rh}], SLIP.ex: forsterkning. Ingen tilbakekobling til løftet. */
    let SLIP = null;
    function propAdd(x, y, z, v) {
      const S_ = SLIP; if (!S_ || !S_.p.length || !res) return;
      const al = res.alpha * DEG, ex = Math.cos(al), ez = Math.sin(al);
      for (const q of S_.p) {
        const dx = x - q.c[0], dy = y - q.c[1], dz = z - q.c[2], xi = dx * ex + dz * ez;
        if (xi < -1.5 * q.R || xi > 60) continue;
        const rx = dx - xi * ex, rz = dz - xi * ez, r2 = rx * rx + dy * dy + rz * rz, r = Math.sqrt(r2);
        const den = Math.sqrt(xi * xi + q.R * q.R), du = q.a * (1 + xi / den), Rx = q.R * Math.sqrt((1 + q.a) / (1 + du));
        if (r > 1.25 * Rx) continue;
        const e0 = 0.88 * Rx, sm = r <= e0 ? 1 : 1 - (r - e0) / (1.25 * Rx - e0), smo = sm * sm * (3 - 2 * sm);
        const ddu = q.a * q.R * q.R / (den * den * den), vr = -0.5 * Math.min(r, Rx) * ddu * smo;
        let ux = du * smo, rr = r > 1e-6 ? 1 / r : 0;
        v[0] += (ux * ex + vr * rx * rr) ; v[1] += vr * dy * rr; v[2] += (ux * ez + vr * rz * rr);
        if (xi > -0.05 * q.R && r > 1e-6) {
          const vt = (r < q.rh ? q.K * r / (q.rh * q.rh) : q.K / r) * smo * Math.min(1, (xi + 0.05 * q.R) / (0.15 * q.R));
          // tangent t = e × r̂ (e = strålens akse): med klokka sett bakfra
          const tx = (0 * rz - ez * dy) * rr, ty = (ez * rx - ex * rz) * rr, tz = (ex * dy - 0 * rx) * rr;
          v[0] += vt * tx; v[1] += vt * ty; v[2] += vt * tz;
        }
      }
    }
    const CR = [0, 0, 0, 0, 0, 0];
    /* skyv punktet ut av faste flater; CR[3]: bit 1 = separert, bit 2 = traff flaten; CR[4] = turbulensamplitude */
    /* noDead: røykpartikler skal kunne gå inn i den separerte sonen (resirkulasjon); da flyttes de ikke ut av den,
       men CR[3] bit 4 markerer at punktet er inne i sonen */
    function collide(lx, ly, lz, noDead) {
      const w = wing; let moved = 0, sep = 0, amp = 0;
      if (Math.abs(ly) < w.s) {
        const c = w.chord(ly), xc = (lx - w.xle(ly)) / c;
        if (xc > -0.02 && xc < 1.02) {
          const xx = xc < 0 ? 0 : xc > 1 ? 1 : xc, zu = wingZ(ly, xx, c, true, 0.012), zl = wingZ(ly, xx, c, false, 0.012);
          if (lz < zu && lz > zl) { lz = (lz - (zu + zl) / 2) >= 0 ? zu : zl; moved = 2; }
        }
        if (xc > -0.05) {
          const dz = deadZone(lx, ly, lz);
          if (dz.inside) { if (noDead) moved |= 4; else lz = dz.top + 0.004; sep = 1; } amp = dz.amp; if (amp > 0.002) sep = 1;
        }
      }
      const T = FT, u = (lx - T.x0) / T.len;
      if (u > 0 && u < 1) {
        const i = Math.min(T.n - 1, (u * T.n) | 0), hw = T.hw[i], hh = T.hh[i], zc = T.zc[i];
        const ey = ly / hw, ez = (lz - zc) / hh, r = Math.sqrt(ey * ey + ez * ez);
        if (r < 1) { if (r < 1e-4) { lz = zc + hh; } else { ly = ey / r * hw; lz = zc + ez / r * hh; } moved = 2; }
      }
      for (const n of T.nac) {
        const t = (lx - n.x0) / n.Lk;
        if (t > 0 && t < 1) {
          const R = n.R[(t * 64) | 0], dy = ly - n.yk, dz = lz - n.zc, r = Math.sqrt(dy * dy + dz * dz);
          if (r < R) { if (r < 1e-4) { lz = n.zc + R; } else { ly = n.yk + dy / r * R; lz = n.zc + dz / r * R; } moved = 2; }
        }
      }
      let wd = 0; if (!sep) { const wk = attachedWake(lx, ly, lz); wd = wk.def; amp = Math.max(amp, 0.14 * wk.def); }
      CR[0] = lx; CR[1] = ly; CR[2] = lz; CR[3] = sep | moved; CR[4] = amp; CR[5] = wd; return CR;
    }

    /* én strømlinje i vingerammen med klassisk RK4 (fast tidssteg h, så punktindeks = flytid).
       Lagrer posisjon, lokal fart |V|/V∞, separasjon, turbulensamplitude og første treffpunkt. */
    function trace(x, y, z, steps, h, ex, o) {
      const al = res.alpha * DEG, ca = Math.cos(al), sa = Math.sin(al), sc = res.scale, f = [0, 0, 0];
      const p = o.p, spd = o.spd, sep = o.sep, tb = o.tb; let hit = null, tprev = 0, n = 0;
      const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0];
      // blandet felt for denne α (3 tall per node, ingen binærsøk) – samme verdier som fieldAt, men flere ganger raskere
      const fast = ensureBlend(al, sc), full = !!o.full;   // full: oppviklet kjerne (strømlinjer); røykdysene bruker samme felt som røyken
      const vel = (X, Y, Z, v) => { if (fast) fieldFast(X, Y, Z, f); else fieldAt(X, Y, Z, al, sc, f); v[0] = ca + f[0] * ex; v[1] = f[1] * ex; v[2] = sa + f[2] * ex; coreSwirl(X, Y, Z, v, ex, full); nearWall(X, Y, Z, v, ex); propAdd(X, Y, Z, v); };
      let wdef = 0;
      for (; n < steps; n++) {
        vel(x, y, z, k1);
        vel(x + k1[0] * h / 2, y + k1[1] * h / 2, z + k1[2] * h / 2, k2);
        vel(x + k2[0] * h / 2, y + k2[1] * h / 2, z + k2[2] * h / 2, k3);
        vel(x + k3[0] * h, y + k3[1] * h, z + k3[2] * h, k4);
        // i det turbulente kjølvannet går middelstrømmen saktere (hastighetsunderskudd); fargen viser det samme
        const kd = (tprev > 0.01 ? 1 - Math.min(0.45, tprev * 2.2) : 1) * (1 - Math.min(0.4, wdef));
        p.push(x, y, z); spd.push(Math.hypot(k1[0], k1[1], k1[2]) * kd);
        let hx = (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, hy = (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6, hz = (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) / 6;
        hx *= kd; hz *= kd;
        x += hx * h; y += hy * h; z += hz * h;
        const c = collide(x, y, z); x = c[0]; y = c[1]; z = c[2]; sep.push(c[3] & 1); if ((c[3] & 2) && !hit) hit = [x, y, z];
        wdef = c[5]; tprev = Math.max(c[4], tprev * 0.997); tb.push(tprev);
        const X = (x - B.px) * ca + (z - B.py) * sa, Yw = -(x - B.px) * sa + (z - B.py) * ca;
        if (X > B.x1 || X < B.x0 || Yw < B.y0 + 0.05 || Yw > B.y1 - 0.05 || Math.abs(y) > B.z - 0.05 || !Number.isFinite(x)) { n++; break; }
      }
      return hit;
    }
    /* mange linjer, pakket i typede tabeller. Rette partier tynnes ut (punktene beholder flytiden). */
    /* dirs[L] = 2: integrer både bakover og forover fra frøet (frø midt i strømmen, f.eks. ved tippvirvelen);
       flytiden settes så t = 0 ligger ved x0 (raken), slik at pulsene er i fase med linjene fra raken */
    function traceMany(seeds, steps, h, ex, thin, dirs, x0, back) {
      ensureCore();
      const nL = seeds.length / 3, off = new Uint32Array(nL + 1), hits = new Float32Array(nL * 3).fill(NaN);
      const P3 = [], SP = [], SE = [], TB = [], TT = [];
      const o = { p: [], spd: [], sep: [], tb: [], full: true }, ob = { p: [], spd: [], sep: [], tb: [], full: true };
      for (let L = 0; L < nL; L++) {
        o.p.length = o.spd.length = o.sep.length = o.tb.length = 0;
        let hit = null, t0 = 0;
        if (dirs && dirs[L] === 2) {
          ob.p.length = ob.spd.length = ob.sep.length = ob.tb.length = 0;
          trace(seeds[3 * L], seeds[3 * L + 1], seeds[3 * L + 2], back || Math.round(steps * 0.6), -h, ex, ob);
          const nb = ob.spd.length;
          for (let i = nb - 1; i >= 1; i--) { o.p.push(ob.p[3 * i], ob.p[3 * i + 1], ob.p[3 * i + 2]); o.spd.push(ob.spd[i]); o.sep.push(ob.sep[i]); o.tb.push(0); }
          const ox = o.p.length ? o.p[0] : seeds[3 * L]; t0 = Math.max(0, ox - (x0 == null ? ox : x0));
          const cut = o.spd.length; hit = trace(seeds[3 * L], seeds[3 * L + 1], seeds[3 * L + 2], steps, h, ex, o); void cut;
        } else hit = trace(seeds[3 * L], seeds[3 * L + 1], seeds[3 * L + 2], steps, h, ex, o);
        if (hit) { hits[3 * L] = hit[0]; hits[3 * L + 1] = hit[1]; hits[3 * L + 2] = hit[2]; }
        const n = o.spd.length; let last = -1, lx = 0, ly = 0, lz = 0, tx = 0, ty = 0, tz = 0;
        for (let i = 0; i < n; i++) {
          const x = o.p[3 * i], y = o.p[3 * i + 1], z = o.p[3 * i + 2];
          let keep = !thin || i === 0 || i === n - 1;
          if (!keep) {
            const dx = x - lx, dy = y - ly, dz = z - lz, d = Math.hypot(dx, dy, dz);
            const nx = o.p[3 * i + 3] - x, ny = o.p[3 * i + 4] - y, nz = o.p[3 * i + 5] - z, dn = Math.hypot(nx, ny, nz) || 1;
            const cs = (tx * nx + ty * ny + tz * nz) / dn;
            keep = d > 0.42 || cs < 0.9994 || o.sep[i] !== o.sep[Math.max(0, i - 1)] || (o.tb[i] > 0.002 && d > 0.16) || Math.abs(o.spd[i] - o.spd[last]) > 0.025;
          }
          if (keep) {
            P3.push(x, y, z); SP.push(o.spd[i]); SE.push(o.sep[i]); TB.push(o.tb[i]); TT.push(t0 + i * Math.abs(h));
            if (i < n - 1) { const nx = o.p[3 * i + 3] - x, ny = o.p[3 * i + 4] - y, nz = o.p[3 * i + 5] - z, dn = Math.hypot(nx, ny, nz) || 1; tx = nx / dn; ty = ny / dn; tz = nz / dn; }
            lx = x; ly = y; lz = z; last = i;
          }
        }
        off[L + 1] = SP.length;
      }
      return { off, p: Float32Array.from(P3), spd: Float32Array.from(SP), sep: Uint8Array.from(SE), tb: Float32Array.from(TB), t: Float32Array.from(TT), hits };
    }

    /* krysstrømsplan x = X0 (vingeramme): virvlighet ωx = ∂w/∂y − ∂v/∂z og hastighet i planet (v, w) */
    function crossPlane(X0, Y0, Y1, Z0, Z1, NY, NZ, ex) {
      ensureCore();
      const al = res.alpha * DEG, sc = res.scale, f = [0, 0, 0], hy = (Y1 - Y0) / (NY - 1), hz = (Z1 - Z0) / (NZ - 1), cv = [0, 0, 0];
      const vv = new Float32Array(NY * NZ), ww = new Float32Array(NY * NZ), om = new Float32Array(NY * NZ), solid = new Uint8Array(NY * NZ);
      for (let b = 0; b < NZ; b++) for (let a = 0; a < NY; a++) {
        const y = Y0 + hy * a, z = Z0 + hz * b, q = b * NY + a;
        fieldAt(X0, y, z, al, sc, f); cv[0] = 0; cv[1] = f[1]; cv[2] = f[2]; coreSwirl(X0, y, z, cv, 1); propAdd(X0, y, z, cv); vv[q] = cv[1] * ex; ww[q] = cv[2] * ex;
        const c = collide(X0, y, z); solid[q] = (c[3] & 2) ? 1 : 0;
      }
      for (let b = 0; b < NZ; b++) for (let a = 0; a < NY; a++) {
        const q = b * NY + a, a0 = Math.max(0, a - 1), a1 = Math.min(NY - 1, a + 1), b0 = Math.max(0, b - 1), b1 = Math.min(NZ - 1, b + 1);
        om[q] = (ww[b * NY + a1] - ww[b * NY + a0]) / ((a1 - a0) * hy) - (vv[b1 * NY + a] - vv[b0 * NY + a]) / ((b1 - b0) * hz);
      }
      // lett utjevning (rutenettfeltet er trilineært, så deriverte er stykkevis konstante)
      const sm = new Float32Array(NY * NZ);
      for (let b = 0; b < NZ; b++) for (let a = 0; a < NY; a++) {
        let s = 0, wsum = 0;
        for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) {
          const aa = a + da, bb = b + db; if (aa < 0 || bb < 0 || aa >= NY || bb >= NZ) continue;
          const wgt = (da ? 1 : 2) * (db ? 1 : 2); s += om[bb * NY + aa] * wgt; wsum += wgt;
        }
        sm[b * NY + a] = s / wsum;
      }
      return { om: sm, v: vv, w: ww, solid };
    }

    /* Fartsplan |V|/V∞ for snittvisningen: et rutenett O + i·U + j·V (vingeramme) med samme hastighet som strømlinjene
       (felt + tippvirvelkjerne + nærvegg). Faste flater (vinge, skrog, gondoler) markeres. I den separerte sonen bak
       separasjonslinjen brukes modellens eget kjølvann (samme hastighetsunderskudd som strømlinjene), ikke en turbulensmodell. */
    function speedPlane(O, U, V, NU, NV, ex) {
      ensureCore();
      const al = res.alpha * DEG, ca = Math.cos(al), sa = Math.sin(al), sc = res.scale, f = [0, 0, 0], v = [0, 0, 0];
      const fast = ensureBlend(al, sc);
      const spd = new Float32Array(NU * NV), solid = new Uint8Array(NU * NV), fac = new Float32Array(NU * NV).fill(1), wdf = new Float32Array(NU * NV);
      const VX = new Float32Array(NU * NV), VY = new Float32Array(NU * NV), VZ = new Float32Array(NU * NV);
      let p0 = 0;   // tilført totaltrykk i propellstrømmen (Bernoulli gjelder ikke over skiven): ΔCp0 ≈ (1 + Δu)² − 1 i strålen
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const u = i / (NU - 1), w = j / (NV - 1), q = j * NU + i;
        const x = O[0] + U[0] * u + V[0] * w, y = O[1] + U[1] * u + V[1] * w, z = O[2] + U[2] * u + V[2] * w;
        const c = collide(x, y, z, true);
        if (c[3] & 2) { solid[q] = 1; continue; }
        if (fast) fieldFast(x, y, z, f); else fieldAt(x, y, z, al, sc, f);
        v[0] = ca + f[0] * ex; v[1] = f[1] * ex; v[2] = sa + f[2] * ex; coreSwirl(x, y, z, v, ex, true); nearWall(x, y, z, v, ex);
        const vb0 = v[0], vb1 = v[1], vb2 = v[2]; propAdd(x, y, z, v);
        const vb = Math.sqrt(vb0 * vb0 + vb1 * vb1 + vb2 * vb2);
        spd[q] = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); VX[q] = v[0]; VY[q] = v[1]; VZ[q] = v[2];
        wdf[q] = spd[q] * spd[q] - vb * vb;   // ekstra totaltrykk fra propellen (ΔCp0 > 0)
        if (c[3] & 4) fac[q] = 0.22; else if (c[4] > 0.002 && (c[3] & 1)) fac[q] = 1 - Math.min(0.45, c[4] * 2.2);
        if (c[5] > 0) fac[q] *= 1 - Math.min(0.4, c[5]);
      }
      void p0;
      /* Underskuddet kommer fra stallmodellen per stripe (trappetrinn langs spennet); det glattes over ~ én stripebredde
         (to omganger boksfilter ≈ gauss) før det legges på farten. Selve potensialfeltet glattes ikke. */
      const Rr = Math.max(1, Math.round(Math.min(NU, NV) / 40)), tmp = new Float32Array(NU * NV);
      const box = (src, dst, along) => {
        const n = along ? NU : NV, m = along ? NV : NU;
        for (let b = 0; b < m; b++) { let acc = 0, cnt = 0;
          const at = a => along ? b * NU + a : a * NU + b;
          for (let a = -Rr; a <= Rr; a++) if (a >= 0 && a < n) { acc += src[at(a)]; cnt++; }
          for (let a = 0; a < n; a++) { dst[at(a)] = acc / cnt; const o = a - Rr, i2 = a + Rr + 1;
            if (o >= 0) { acc -= src[at(o)]; cnt--; } if (i2 < n) { acc += src[at(i2)]; cnt++; } } }
      };
      for (let it = 0; it < 2; it++) { box(fac, tmp, true); box(tmp, fac, false); }
      /* totaltrykktap Cp0,tap = 1 − (p0 − p∞)/q∞: statisk trykk i kjølvannet settes lik potensialstrømmens (tynt skjærlag), så
         tapet er V_pot² − V² = V_pot²·(1 − fac²); propellens tilførte totaltrykk trekkes fra (negativt «tap» = gevinst) */
      const cp0 = new Float32Array(NU * NV), om = new Float32Array(NU * NV);
      for (let q = 0; q < NU * NV; q++) { const vp = spd[q]; spd[q] *= fac[q]; VX[q] *= fac[q]; VY[q] *= fac[q]; VZ[q] *= fac[q]; cp0[q] = solid[q] ? 0 : vp * vp * (1 - fac[q] * fac[q]) - wdf[q]; }
      /* virvlighet normalt på planet (sentrerte differanser i planets akser; faste celler hoppes over): ω = ∂(v·V̂)/∂s_U − ∂(v·Û)/∂s_V */
      const LU = Math.hypot(U[0], U[1], U[2]), LV = Math.hypot(V[0], V[1], V[2]), hu = LU / (NU - 1), hv = LV / (NV - 1);
      const uh = [U[0] / LU, U[1] / LU, U[2] / LU], vh = [V[0] / LV, V[1] / LV, V[2] / LV];
      const cU = q => VX[q] * uh[0] + VY[q] * uh[1] + VZ[q] * uh[2], cV = q => VX[q] * vh[0] + VY[q] * vh[1] + VZ[q] * vh[2];
      for (let j = 1; j < NV - 1; j++) for (let i = 1; i < NU - 1; i++) {
        const q = j * NU + i; if (solid[q] || solid[q - 1] || solid[q + 1] || solid[q - NU] || solid[q + NU]) continue;
        om[q] = (cV(q + 1) - cV(q - 1)) / (2 * hu) - (cU(q + NU) - cU(q - NU)) / (2 * hv);
      }
      return { spd, solid, cp0, om };
    }

    /* Cp på overflaten fra feltet: tangentiell fart like utenfor flaten. pos/nor i vingerammen. */
    function surfaceCp(pos, nor, out) {
      const al = res.alpha * DEG, ca = Math.cos(al), sa = Math.sin(al), f = [0, 0, 0], n = pos.length / 3;
      for (let i = 0; i < n; i++) {
        const nx = nor[3 * i], ny = nor[3 * i + 1], nz = nor[3 * i + 2];
        fieldAt(pos[3 * i] + nx * 0.05, pos[3 * i + 1] + ny * 0.05, pos[3 * i + 2] + nz * 0.05, al, res.scale, f);
        const u = ca + f[0], v = f[1], w = sa + f[2], dn = u * nx + v * ny + w * nz;
        const tu = u - dn * nx, tv = v - dn * ny, tw = w - dn * nz;
        out[i] = Math.max(-2.5, 1 - (tu * tu + tv * tv + tw * tw));
      }
      return out;
    }

    return {
      F, B, DZ,
      get wing() { return wing; }, get res() { return res; }, get FT() { return FT; },
      setWing(w, params, model) { wing = w; G = params; buildFusTab(model); },
      setRes(r) { res = r; },
      setField(f) { Object.assign(F, f); },
      setBounds(b) { Object.assign(B, b); },
      setSlip(sl) { SLIP = sl && sl.p && sl.p.length ? sl : null; }, get slip() { return SLIP; }, propAdd, attachedWake,
      fieldAt, fieldFast, ensureBlend, wingZ, wingSurf, stripAt, sepFrac, stripCp, nearWall, coreSwirl, ensureCore, get core() { return CORE; }, deadZone, collide, trace, traceMany, crossPlane, speedPlane, surfaceCp
    };
  }

  /* Forkantens tilstand (ren, insekter, frost, is): profilsnittets grensesjiktmodell gir forholdet k = CL maks (forurenset) /
     CL maks (ren). Her skaleres hver stripes cl maks med k, og kritisk α og CL maks for vingen regnes på nytt på samme måte
     som i physics.buildWing (første stripe som når sin cl maks). Selve virvelgitteret er uendret. */
  function applyLE(w, k) {
    if (!w || !(k > 0) || Math.abs(k - 1) < 1e-6) return w;
    let aS = Infinity, jS = 0;
    for (let j = 0; j < w.N; j++) {
      w.clmax[j] *= k;
      if (w.Sa[j] <= 0) continue;
      const aj = (w.clmax[j] * w.c[j] / 2 - w.Sb[j]) / w.Sa[j];
      if (aj < aS) { aS = aj; jS = j; }
    }
    w.alphaStall = aS; w.stallStation = w.ym[jS] / w.s; w.CLmax = w.CLa * aS + w.CLb; w.leK = k;
    return w;
  }
  root.FLOW3D = { make, applyLE };

  /* ---------- som Web Worker: egen kopi av vinge, felt og tilstand ---------- */
  const isWorker = typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope;
  if (isWorker) {
    let ctx = null, P = null, params = null, ac = null, cur = null, resKey = '';
    function state(d) {
      const k = d.alpha + ':' + (ctx.wing && ctx.wing.s) + ':' + params.twist + ':' + params.flapDeg;
      if (k !== resKey || !ctx.res || ctx.res.alpha !== d.alpha) { ctx.setRes(P.evaluate(ctx.wing, d.alpha, P.AIRCRAFT[ac].cd0)); resKey = k; }
      ctx.F.wt = d.wt; if (d.bounds) ctx.setBounds(d.bounds);
    }
    function postTrace(d, a, b, t0, last) {
      const r = ctx.traceMany(d.seeds.subarray(a * 3, b * 3), d.steps, d.h, d.ex, d.thin, d.dirs ? d.dirs.subarray(a, b) : null, d.x0, d.back);
      r.id = d.id; r.ms = Date.now() - t0; r.smoke = d.smoke; r.from = a; r.last = !!last; r.total = d.seeds.length / 3;
      root.postMessage({ type: 'trace', r }, [r.off.buffer, r.p.buffer, r.spd.buffer, r.sep.buffer, r.tb.buffer, r.t.buffer, r.hits.buffer]);
    }
    function step() {
      if (!cur) return; const c = cur, d = c.d, nL = d.seeds.length / 3;
      try {
        state(d);
        const b = Math.min(nL, c.i + d.chunk); postTrace(d, c.i, b, c.t0, b >= nL); c.i = b;
        if (b < nL && cur === c) setTimeout(step, 0); else if (cur === c) cur = null;
      } catch (err) { cur = null; root.postMessage({ type: 'error', msg: String(err && err.message || err) }); }
    }
    root.onmessage = function (e) {
      const d = e.data;
      try {
        if (d.type === 'init') { importScripts(d.physics); P = root.VLab; ctx = make(P); return; }
        if (d.type === 'geom') {
          params = d.params; ac = d.ac;
          const w = applyLE(P.buildWing(params), params.leK || 1); ctx.setWing(w, params, P.AIRCRAFT[ac].model); ctx.setSlip(params.slip || null); resKey = ''; cur = null;
          return;
        }
        if (d.type === 'slip') { if (ctx) ctx.setSlip(d.slip); return; }
        if (d.type === 'field') { ctx.setField({ data: d.data, xs: d.xs, ys: d.ys, zs: d.zs, nx: d.nx, ny: d.ny, nz: d.nz }); return; }
        if (d.type === 'cancel') { cur = null; return; }
        // felles tilstand per jobb: α, kjølvannsblanding, grenser
        if (!ctx || !ctx.wing) return;
        state(d);
        if (d.type === 'trace') {
          /* i biter: hver bit sendes tilbake med en gang (progressiv visning), og en ny jobb avbryter den gamle
             mellom bitene (α-glideren kan dras uten at gamle jobber hoper seg opp) */
          const chunk = d.chunk || 0, nL = d.seeds.length / 3; cur = null;
          if (!chunk || nL <= chunk) { postTrace(d, 0, nL, Date.now(), true); return; }
          cur = { d, i: 0, t0: Date.now() }; setTimeout(step, 0);
        } else if (d.type === 'plane') {
          const r = ctx.crossPlane(d.X0, d.Y0, d.Y1, d.Z0, d.Z1, d.NY, d.NZ, d.ex); r.id = d.id;
          root.postMessage({ type: 'plane', r }, [r.om.buffer, r.v.buffer, r.w.buffer, r.solid.buffer]);
        } else if (d.type === 'vslice') {
          const t0 = Date.now(), r = ctx.speedPlane(d.O, d.U, d.V, d.NU, d.NV, d.ex); r.id = d.id; r.ms = Date.now() - t0; r.NU = d.NU; r.NV = d.NV;
          root.postMessage({ type: 'vslice', r }, [r.spd.buffer, r.solid.buffer, r.cp0.buffer, r.om.buffer]);
        } else if (d.type === 'cp') {
          const out = new Float32Array(d.pos.length / 3); ctx.surfaceCp(d.pos, d.nor, out);
          root.postMessage({ type: 'cp', id: d.id, cp: out }, [out.buffer]);
        }
      } catch (err) { root.postMessage({ type: 'error', msg: String(err && err.message || err) }); }
    };
  }
})(typeof self !== 'undefined' ? self : window);
