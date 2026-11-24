/* NORDAP – Workspace map in 3D, core (no DOM): runs in the browser (window.WSGRAPH3D) and in node tests.
   The map is a brain (layout3d, shell): every section a region on the upper cerebrum, its items on the surface there,
   the biggest sections choosing their room first. shell(L, n) gives the particles that draw the brain itself.
   (Before, the map was a cloud: every group (an aircraft, a topic, then 'Unsorted') a soft ball of evenly spaced points, slightly flattened
   front to back, the balls side by side as in the 2D map (WSGRAPH.arrange) and set at a little different depths, so the
   cloud has parallax when it turns. No surface, no outline: the soft look comes from a few large puffs of light per group.
   layout3d(g, opts) -> { P: Float32Array(3N) world (x right, y up, z front), grow: Float32Array(N) (0 in the middle of
                  the cloud .. 1 at its edge: the grow-in on open runs outwards), clusters: [{ key, ac, n, m, c:[x,y,z], r }],
                  gi: Int32Array(N) group per node, R (world radius round the centre), center, D (point spacing) }.
                  Deterministic; computed once, nothing is simulated later. opts.aspect: the plate's width / height.
   puffs(clusters) -> Float32Array(5 per puff: x, y, z, radius, group): the soft light of each group (deterministic).
   node --test tests/wsgraph3d.test.mjs */
(function (G) {
  'use strict';
  const GW = G.WSGRAPH || (typeof require !== 'undefined' ? require('./wsgraph.js') : null);
  const hash = GW.hash, prng = GW.prng;
  const D = 6, FLAT = 0.7; /* point spacing (world units); the balls are this deep for their width */
  /* the places in a ball, nearest the middle first: a jittered lattice, the middle exactly at 0 */
  let lat = null;
  function lattice(n) {
    if (lat && lat.length >= n) return lat;
    const R = prng(hash('cloud3d-lattice')), want = Math.max(n, 64) * 1.6, rr = Math.cbrt(want / (4 / 3 * Math.PI * FLAT)) + 1.5, out = [];
    const e = p => Math.hypot(p[0], p[1], p[2] / FLAT);
    for (let z = -Math.ceil(rr); z <= rr; z++) for (let y = -Math.ceil(rr); y <= rr; y++) for (let x = -Math.ceil(rr); x <= rr; x++) {
      const j = x || y || z ? 0.12 : 0, p = [(x + (R() - 0.5) * 2 * j) * D, (y + (R() - 0.5) * 2 * j + (z % 2 ? 0.5 : 0)) * D, (z + (R() - 0.5) * 2 * j) * D * FLAT];
      if (e(p) <= rr * D) out.push(p);
    }
    out.sort((a, b) => e(a) - e(b) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return (lat = out);
  }
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const cache = new Map();

  /* ---------- the brain: two hemispheres, the cerebellum and the stem, in units of S (1 = half the brain's length) ----------
     x right, y up, z front. Points are taken on the surfaces and pushed in and out along the normal by a folding pattern
     (gyri and sulci), with more points on the ridges, so a cloud of small particles reads as a brain. Deterministic. */
  /* k: 0 left and 1 right cerebrum (a hemisphere and its temporal lobe), 2 cerebellum, 3 stem */
  const PARTS = [
    { c: [-0.27, 0.07, 0], a: [0.36, 0.5, 0.82], k: 0, hemi: 1 },    /* left hemisphere */
    { c: [0.27, 0.07, 0], a: [0.36, 0.5, 0.82], k: 1, hemi: 1 },     /* right hemisphere */
    { c: [-0.33, -0.25, 0.1], a: [0.2, 0.18, 0.46], k: 0 },          /* left temporal lobe */
    { c: [0.33, -0.25, 0.1], a: [0.2, 0.18, 0.46], k: 1 },           /* right temporal lobe */
    { c: [0, -0.4, -0.56], a: [0.42, 0.2, 0.26], k: 2 },             /* cerebellum */
    { c: [0, -0.6, -0.22], a: [0.11, 0.3, 0.12], k: 3 }              /* brain stem */
  ];
  const SHARE = [0.36, 0.36, 0.065, 0.065, 0.12, 0.03];
  const inPart = (p, q, m) => ((p[0] - q.c[0]) / q.a[0]) ** 2 + ((p[1] - q.c[1]) / q.a[1]) ** 2 + ((p[2] - q.c[2]) / q.a[2]) ** 2 < m;
  /* 3D gradient noise (Perlin), deterministic: the folds follow it, so they wind without lining up with any axis */
  const PERM = (() => { const R = prng(hash('brain-noise')), a = []; for (let i = 0; i < 256; i++) a.push(i); for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.concat(a); })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y, z) => { const u = (h & 15) < 8 ? x : y, v = (h & 15) < 4 ? y : (h & 15) === 12 || (h & 15) === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  function noise(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z), A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
    return lerp(lerp(lerp(grad(PERM[AA], x, y, z), grad(PERM[BA], x - 1, y, z), u), lerp(grad(PERM[AB], x, y - 1, z), grad(PERM[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(PERM[AA + 1], x, y, z - 1), grad(PERM[BA + 1], x - 1, y, z - 1), u), lerp(grad(PERM[AB + 1], x, y - 1, z - 1), grad(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  /* the folds: winding ridges on the cerebrum (ridged noise, a little warped), fine parallel folds on the cerebellum;
     0 (deep in a sulcus) .. 1 (top of a gyrus) */
  function fold(p, k) {
    if (k === 2) return Math.pow(0.5 + 0.5 * Math.sin(p[1] * 90 + noise(p[0] * 4, p[1] * 4, p[2] * 4) * 3), 2);
    if (k === 3) return 0.55;
    const F = 10.5, wx = noise(p[0] * 3 + 11, p[1] * 3, p[2] * 3) * 0.35, wy = noise(p[0] * 3, p[1] * 3 + 23, p[2] * 3) * 0.35;
    const v = noise(p[0] * F + wx * F, p[1] * F + wy * F, p[2] * F);
    return Math.max(0, 1 - Math.abs(v) * 4.2);
  }
  /* n points on the brain: { P (units of S), F fold, K part, N outward normals } */
  const shellCache = new Map();
  function brainPoints(n, seed) {
    const key = n + '|' + (seed || ''); if (shellCache.has(key)) return shellCache.get(key);
    const R = prng(hash('brain|' + (seed || ''))), P = [], F = [], K = [], Nn = [];
    PARTS.forEach((q, pi) => {
      const k = q.k; let want = Math.round(n * SHARE[pi]), tries = 0;
      while (want > 0 && tries++ < n * 60) {
        let u = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; const ul = Math.hypot(u[0], u[1], u[2]); if (ul > 1 || ul < 0.05) continue; u = u.map(x => x / ul);
        /* the cerebrum's underside is flatter (a shorter half-axis below the middle, so the surface stays smooth) */
        const ay = q.hemi && u[1] < 0 ? q.a[1] * 0.62 : q.a[1];
        if (ay !== q.a[1] && R() > 0.78 + 0.22 * (1 - Math.abs(u[1]))) continue;   /* the same density above and below (no line round the middle) */
        let p = [q.c[0] + u[0] * q.a[0], q.c[1] + u[1] * ay, q.c[2] + u[2] * q.a[2]];
        /* a brain, not two eggs: the frontal lobe narrows and its underside lifts, the back stays full */
        if (q.hemi && p[2] > 0.1) { const f = Math.pow((p[2] - 0.1) / 0.72, 1.5); p[0] = q.c[0] + (p[0] - q.c[0]) * (1 - 0.22 * f); if (p[1] < q.c[1]) p[1] = q.c[1] + (p[1] - q.c[1]) * (1 - 0.4 * f); }
        /* the hemispheres do not show their inner faces (the fissure stays open) */
        if (k < 2 && (k === 0 ? p[0] > -0.035 : p[0] < 0.035)) continue;
        if (PARTS.some((o, j) => j !== pi && !(k === 3 && o.k === 2) && inPart(p, o, k < 2 ? 0.97 : 1))) continue;
        let nr = [(p[0] - q.c[0]) / (q.a[0] * q.a[0]), (p[1] - q.c[1]) / (ay * ay), (p[2] - q.c[2]) / (q.a[2] * q.a[2])]; const nl = Math.hypot(nr[0], nr[1], nr[2]); nr = nr.map(x => x / nl);
        const f = fold(p, k), dep = k < 2 ? 0.045 : k === 2 ? 0.012 : 0;
        if (k < 3 && R() > 0.18 + 0.82 * f * f) continue;   /* more particles on the ridges: the folds show */
        p = [p[0] + nr[0] * dep * (f - 0.5), p[1] + nr[1] * dep * (f - 0.5), p[2] + nr[2] * dep * (f - 0.5)];
        P.push(p); F.push(f); K.push(k); Nn.push(nr); want--;
      }
    });
    const res = { P, F, K, N: Nn }; if (shellCache.size > 6) shellCache.clear(); shellCache.set(key, res); return res;
  }
  /* the brain's size (world units) for N items: big enough that every item has room on the surface */
  /* ---------- the brain as a surface (drawn as one smooth, lit mesh) ----------
     brainMesh(level) -> { P Float32Array(3V) (units of S), I Uint32Array (triangles), F Float32Array(V) fold 0 sulcus .. 1 gyrus,
     K Int8Array(V) part (0 left, 1 right cerebrum, 2 cerebellum, 3 stem), O Float32Array(3V) outward direction }.
     Each part is a subdivided icosahedron pulled onto the part's shape: hemispheres with a flat inner wall at the
     fissure, a narrower frontal lobe, the temporal lobe and the Sylvian fissure below, then pushed in along winding
     sulci (ridged, warped noise) so the gyri stand out. Deterministic. level 6 ~ 180k triangles, 5 ~ 45k. */
  function ico(level) {
    const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let l = 0; l < level; l++) {
      const mid = new Map(), m = (a, b) => { const k = a < b ? a * 1e6 + b : b * 1e6 + a; let i = mid.get(k); if (i == null) { const v = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]], n = Math.hypot(...v); i = V.length; V.push(v.map(x => x / n)); mid.set(k, i); } return i; };
      const nf = []; for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } F = nf;
    }
    return { V, F };
  }
  const meshCache = new Map();
  function brainMesh(level) {
    level = level || 6; if (meshCache.has(level)) return meshCache.get(level);
    const P = [], I = [], Fd = [], K = [], O = [];
    const add = (sph, map) => { const base = P.length / 3; sph.V.forEach(u => { const r = map(u); P.push(r.p[0], r.p[1], r.p[2]); Fd.push(r.f); K.push(r.k); O.push(r.o[0], r.o[1], r.o[2]); }); sph.F.forEach(f => I.push(base + f[0], base + f[1], base + f[2])); };
    const sulc = (x, y, z, f) => { const wx = noise(x * 2.6 + 11, y * 2.6, z * 2.6) * 0.32, wy = noise(x * 2.6, y * 2.6 + 23, z * 2.6) * 0.32, wz = noise(x * 2.6 + 5, y * 2.6 + 7, z * 2.6 + 41) * 0.32;
      const v = noise((x + wx) * f, (y + wy) * f, (z + wz) * f), v2 = noise((x - wy) * f * 2.1 + 3, (y + wz) * f * 2.1, (z + wx) * f * 2.1);
      return Math.max(Math.exp(-v * v / 0.0058), 0.22 * Math.exp(-v2 * v2 / 0.004)); };
    const hemi = s => u => {
      const c = [0.25 * s, 0.07, 0], ax = 0.37, ay = u[1] < 0 ? 0.33 : 0.5, az = 0.82;
      const r = 1 / Math.sqrt((u[0] / ax) ** 2 + (u[1] / ay) ** 2 + (u[2] / az) ** 2);
      let p = [u[0] * r, u[1] * r, u[2] * r];
      if (s * p[0] < 0) p[0] = Math.sign(p[0]) * 0.235 * Math.pow(Math.abs(p[0]) / ax, 0.42);   /* the inner wall: flat, along the fissure */
      if (p[2] > 0.1) { const f = Math.pow((p[2] - 0.1) / 0.72, 1.5); p[0] *= 1 - 0.24 * f; if (p[1] < 0) p[1] *= 1 - 0.45 * f; }   /* frontal lobe */
      if (p[2] < -0.5 && p[1] > 0) p[1] *= 1 - 0.25 * (-0.5 - p[2]) / 0.32;                                                      /* occipital pole */
      const lat = Math.max(0, s * u[0]), wt = Math.exp(-((u[1] + 0.62) ** 2) / 0.06 - ((u[2] - 0.12) ** 2) / 0.22) * lat;        /* temporal lobe */
      p = [p[0] + s * 0.03 * wt, p[1] - 0.11 * wt, p[2] + 0.04 * wt];
      p = [p[0] + c[0], p[1] + c[1], p[2] + c[2]];
      const o = [(p[0] - c[0]) / (ax * ax), (p[1] - c[1]) / (ay * ay), (p[2] - c[2]) / (az * az)], ol = Math.hypot(...o); for (let k = 0; k < 3; k++) o[k] /= ol;
      const syl = lat * Math.exp(-((p[1] + 0.12 - 0.3 * (p[2] - 0.05)) ** 2) / 0.0016) * (p[2] > -0.25 ? 1 : 0);                  /* Sylvian fissure */
      const sc = s * p[0] < 0.035 ? 0 : sulc(p[0], p[1], p[2], 8.5), dip = 0.028 * sc + 0.035 * syl, f = 1 - Math.min(1, sc + syl);
      return { p: [p[0] - o[0] * dip, p[1] - o[1] * dip, p[2] - o[2] * dip], f, k: s < 0 ? 0 : 1, o };
    };
    const cereb = u => { const c = [0, -0.38, -0.56], a = [0.43, 0.2, 0.27]; const r = 1 / Math.sqrt((u[0] / a[0]) ** 2 + (u[1] / a[1]) ** 2 + (u[2] / a[2]) ** 2);
      const p = [c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r], o = u, b = Math.exp(-Math.pow(Math.sin(p[1] * 70 + noise(p[0] * 6, p[1] * 6, p[2] * 6) * 3.2 + p[2] * 6), 2) / 0.05), dip = 0.014 * b;
      return { p: [p[0] - o[0] * dip, p[1] - o[1] * dip, p[2] - o[2] * dip], f: 1 - b, k: 2, o }; };
    const stem = u => { const c = [0, -0.6, -0.22], a = [0.085, 0.26, 0.095]; const r = 1 / Math.sqrt((u[0] / a[0]) ** 2 + (u[1] / a[1]) ** 2 + (u[2] / a[2]) ** 2); return { p: [c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r], f: 0.8, k: 3, o: u }; };
    const H = ico(level), C = ico(Math.max(3, level - 1));
    add(H, hemi(-1)); add(H, hemi(1)); add(C, cereb);   /* no stem: the brain floats over the scope */
    const res = { P: new Float32Array(P), I: new Uint32Array(I), F: new Float32Array(Fd), K: new Int8Array(K), O: new Float32Array(O) };
    meshCache.set(level, res); return res;
  }
  const sizeFor = N => Math.max(70, Math.sqrt(N * 11) * D * 0.42 + 40);

  /* ---------- the hub airport (the map since Nov 2026) ----------
     layout3d(g) -> { P (items, world; y up, ground at 0), grow, gi, clusters, R, center, D, hub: true, airport }
     The terminal is a round building with the tower in the middle. One pier per section (aircraft, groups, then
     'Unsorted') runs out from it like the spokes of a wheel, evenly round; the section's aircraft is parked at the tip,
     its documents, notes, packs and routes at the gates along both sides, nearest the terminal first, in more rows when
     the pier would get too long. Two parallel runways frame the field. Deterministic.
     cluster: { key, ac, topic, n, m, c (pier middle), r (round the whole pier), tip (label point), dir (out along the pier), len, nrm } */
  const HUB = { D0: 6, RT: 26, PW: 10, PH: 5, SP: 10, SIDE: 9, ROW: 9, MAXG: 14, TIP: 16 };
  function layout3d(g, opts) {
    opts = opts || {};
    const sig = 'hub|' + g.nodes.map(n => n.id + '@' + n.ac).join(',') + '|' + (g.topics || []).map(x => x.id + '=' + x.name).join(',');
    const hit = cache.get(sig); if (hit) return clone(hit);
    const N = g.nodes.length, groups = GW.groupsOf(g), P = new Float32Array(N * 3), gi = new Int32Array(N).fill(-1);
    const n = Math.max(1, groups.length), a0 = -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n), piers = [];
    /* a long pier gets more rows rather than running off forever; the gates start far enough out that neighbouring piers never touch */
    const plan = groups.map(q => { const head = q.ac >= 0 && q.m.includes(q.ac) ? q.ac : -1, rest = q.m.filter(i => i !== head), per = Math.ceil(rest.length / 2), maxg = Math.max(HUB.MAXG, Math.ceil(Math.sqrt(per * 4))), rows = Math.max(1, Math.ceil(per / maxg));
      return { head, rest, per, maxg, rows, span: HUB.PW / 2 + HUB.SIDE + (rows - 1) * HUB.ROW + HUB.D0 }; });
    const span = plan.reduce((m, x) => Math.max(m, x.span), 0), RG = n < 2 ? HUB.RT : Math.max(HUB.RT, (span + HUB.D0) / Math.sin(Math.PI / n) - HUB.SP * 0.8);
    const clusters = groups.map((q, k) => {
      const ang = a0 + k * Math.PI * 2 / n, dir = [Math.cos(ang), 0, Math.sin(ang)], side = [-dir[2], 0, dir[0]];
      const { head, rest, per, maxg } = plan[k], along = Math.max(1, Math.min(per, maxg));
      const len = (RG - HUB.RT) + along * HUB.SP + HUB.SP * 0.6, r0 = HUB.RT - 2, r1 = HUB.RT + len;
      rest.forEach((i, x) => { const sd = x % 2 ? 1 : -1, pos = Math.floor(x / 2), al = pos % maxg, row = Math.floor(pos / maxg);
        const rr = RG + HUB.SP * 0.8 + al * HUB.SP, off = sd * (HUB.PW / 2 + HUB.SIDE + row * HUB.ROW);
        P[i * 3] = dir[0] * rr + side[0] * off; P[i * 3 + 1] = 1.2; P[i * 3 + 2] = dir[2] * rr + side[2] * off; gi[i] = k; });
      const tipR = r1 + HUB.TIP;
      if (head >= 0) { P[head * 3] = dir[0] * tipR; P[head * 3 + 1] = 1.2; P[head * 3 + 2] = dir[2] * tipR; gi[head] = k; }
      const mid = (HUB.RT + tipR) / 2, c = [dir[0] * mid, 0, dir[2] * mid];
      let r = (tipR - HUB.RT) / 2 + HUB.D0; q.m.forEach(i => { r = Math.max(r, Math.hypot(P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]) + 0.5); });
      piers.push({ ang, dir, side, r0, r1, rows: plan[k].rows });
      return { key: q.key, ac: q.ac, topic: q.topic, n: q.n, m: q.m, c, r, tip: [dir[0] * (tipR + 4), 0, dir[2] * (tipR + 4)], dir, len: tipR - HUB.RT, nrm: [0, 1, 0] };
    });
    let reach = HUB.RT + 40; clusters.forEach(c => { reach = Math.max(reach, Math.hypot(c.tip[0], c.tip[2]) + HUB.SIDE + 2 * HUB.ROW); });
    /* runways: two parallels, north and south of the field, longer than the field is wide */
    const rwyZ = reach + 34, rwyLen = Math.max(220, reach * 2.6), runways = [{ z: -rwyZ, len: rwyLen, w: 12 }, { z: rwyZ, len: rwyLen * 0.86, w: 12 }];
    const R = rwyZ + 20;
    const grow = new Float32Array(N); for (let i = 0; i < N; i++) grow[i] = Math.min(1, 0.15 + 0.8 * Math.hypot(P[i * 3], P[i * 3 + 2]) / Math.max(1, reach));
    const res = { P, grow, gi, clusters, R, center: [0, 0, 0], D, hub: true, airport: { RT: HUB.RT, PW: HUB.PW, PH: HUB.PH, reach, piers, runways }, cols: 0 };
    if (cache.size > 8) cache.clear(); cache.set(sig, res);
    return clone(res);
  }
  /* the particles of the brain itself for drawing: world positions, normals, fold, part, region (nearest cluster on the cerebrum, else -1) */
  /* the brain mesh in world units for drawing, with the region (nearest section on the cerebrum, else -1) of every vertex */
  function shell(L, level) {
    const M = brainMesh(level || 6), S = L.S, n = M.K.length, P = new Float32Array(n * 3), reg = new Int32Array(n).fill(-1), reg2 = new Int32Array(n).fill(-1), mix = new Float32Array(n).fill(1);
    const A = L.clusters.map(c => c.c.map(x => x / S));
    for (let j = 0; j < n; j++) {
      const p = [M.P[j * 3], M.P[j * 3 + 1], M.P[j * 3 + 2]]; P[j * 3] = p[0] * S; P[j * 3 + 1] = p[1] * S; P[j * 3 + 2] = p[2] * S;
      if (M.K[j] < 2 && A.length) { let bk = -1, bd = Infinity, ck = -1, cd = Infinity; for (let k = 0; k < A.length; k++) { const dd = d2(p, A[k]); if (dd < bd) { cd = bd; ck = bk; bd = dd; bk = k; } else if (dd < cd) { cd = dd; ck = k; } }
        reg[j] = bk; reg2[j] = ck; if (ck >= 0) mix[j] = 0.5 + 0.5 * Math.min(1, (Math.sqrt(cd) - Math.sqrt(bd)) / 0.09); }   /* soft edges between regions */
    }
    return { P, I: M.I, F: M.F, K: M.K, O: M.O, reg, reg2, mix, n };
  }

  const clone = r => ({ P: r.P.slice(), grow: r.grow.slice(), gi: r.gi.slice(), clusters: r.clusters.map(c => Object.assign({}, c, { c: c.c.slice(), m: c.m.slice(), nrm: c.nrm ? c.nrm.slice() : null, tip: c.tip ? c.tip.slice() : null, dir: c.dir ? c.dir.slice() : null })), R: r.R, center: r.center.slice(), D: r.D, S: r.S, brain: r.brain, hub: r.hub, airport: r.airport, cols: r.cols });

  /* ---------- the soft light: a core and a few puffs round each group ---------- */
  function puffs(clusters) {
    const out = [];
    clusters.forEach((c, gk) => {
      const R = prng(hash('puff3d|' + (c.key || '~'))), n = 6 + Math.min(4, Math.floor(c.m.length / 8));
      out.push(c.c[0], c.c[1], c.c[2], c.r + D * 2.2, gk);
      for (let k = 0; k < n; k++) {
        const y = 1 - 2 * (k + 0.5) / n, rr = Math.sqrt(1 - y * y), a = k * 2.39996 + R() * 0.6, d = c.r * (0.5 + R() * 0.35) + D * 0.6;
        out.push(c.c[0] + Math.cos(a) * rr * d, c.c[1] + y * d * 0.8, c.c[2] + Math.sin(a) * rr * d * FLAT, c.r * (0.45 + R() * 0.25) + D * 1.5, gk);
      }
    });
    return new Float32Array(out);
  }

  const API = { HUB, layout3d, puffs, shell, brainMesh, brainPoints, sizeFor, PARTS, lattice, D, FLAT, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
