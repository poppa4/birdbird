/* NORDAP – My Workspace map in 3D, core (no DOM): runs in the browser (window.WSGRAPH3D) and in node tests.
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
  const PARTS = [
    { c: [-0.285, 0.04, 0.02], a: [0.37, 0.52, 0.8], k: 0 },   /* left hemisphere */
    { c: [0.285, 0.04, 0.02], a: [0.37, 0.52, 0.8], k: 1 },    /* right hemisphere */
    { c: [0, -0.42, -0.5], a: [0.44, 0.19, 0.27], k: 2 },      /* cerebellum */
    { c: [0, -0.58, -0.2], a: [0.11, 0.3, 0.12], k: 3 }        /* brain stem */
  ];
  const SHARE = [0.435, 0.435, 0.115, 0.015];
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
    PARTS.forEach((q, k) => {
      let want = Math.round(n * SHARE[k]), tries = 0;
      while (want > 0 && tries++ < n * 60) {
        let u = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]; const ul = Math.hypot(u[0], u[1], u[2]); if (ul > 1 || ul < 0.05) continue; u = u.map(x => x / ul);
        /* the cerebrum's underside is flatter (a shorter half-axis below the middle, so the surface stays smooth) */
        const ay = k < 2 && u[1] < 0 ? q.a[1] * 0.7 : q.a[1];
        if (ay !== q.a[1] && R() > 0.78 + 0.22 * (1 - Math.abs(u[1]))) continue;   /* the same density above and below (no line round the middle) */
        let p = [q.c[0] + u[0] * q.a[0], q.c[1] + u[1] * ay, q.c[2] + u[2] * q.a[2]];
        /* the hemispheres do not show their inner faces (the fissure stays open) */
        if (k < 2 && (k === 0 ? p[0] > -0.035 : p[0] < 0.035)) continue;
        if (PARTS.some((o, j) => j !== k && !(k === 3 && j === 2) && inPart(p, o, k < 2 ? 0.97 : 1))) continue;
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
  const sizeFor = N => Math.max(70, Math.sqrt(N * 11) * D * 0.42 + 40);

  function layout3d(g, opts) {
    opts = opts || {};
    const sig = g.nodes.map(n => n.id + '@' + n.ac).join(',') + '|' + (g.topics || []).map(x => x.id + '=' + x.name).join(',');
    const hit = cache.get(sig); if (hit) return clone(hit);
    const N = g.nodes.length, groups = GW.groupsOf(g), P = new Float32Array(N * 3), gi = new Int32Array(N).fill(-1), S = sizeFor(N);
    /* candidate places for items: the outer and upper faces of the two hemispheres */
    const BP = brainPoints(Math.max(5000, N * 14), 'layout'), cand = [], top = [];
    BP.P.forEach((p, j) => { if (BP.K[j] < 2 && p[1] > -0.24 && Math.abs(p[0]) > 0.07) { cand.push(j); if (p[1] > 0.02) top.push(cand.length - 1); } });
    const W = j => BP.P[j].map(x => x * S);
    /* the regions: spread over the upper half of the cerebrum (where the home view sees them) by farthest-point sampling,
       the first at the front of the left hemisphere */
    const anchors = [];
    if (groups.length) {
      const start = [-0.42, 0.32, 0.5]; let best = cand[0], bd = Infinity;
      cand.forEach(j => { const dd = d2(BP.P[j], start); if (dd < bd) { bd = dd; best = j; } }); anchors.push(best);
      const T = top.length >= groups.length * 4 ? top.map(x => cand[x]) : cand, md = T.map(j => d2(BP.P[j], BP.P[best]));
      while (anchors.length < groups.length) {
        let bi = 0; for (let x = 1; x < T.length; x++) if (md[x] > md[bi]) bi = x;
        anchors.push(T[bi]); const ap = BP.P[T[bi]]; for (let x = 0; x < T.length; x++) md[x] = Math.min(md[x], d2(BP.P[T[x]], ap));
      }
    }
    /* each candidate belongs to its nearest region; a region takes its own places, nearest first, a spacing apart */
    const own = new Int32Array(cand.length), used = new Uint8Array(BP.P.length), sep2 = (D / S) ** 2 * 0.95;
    cand.forEach((j, x) => { let bk = 0, bd = Infinity; anchors.forEach((a, k) => { const dd = d2(BP.P[j], BP.P[a]); if (dd < bd) { bd = dd; bk = k; } }); own[x] = bk; });
    const taken = [];
    const free = (j, s2) => { const p = BP.P[j]; for (let t = 0; t < taken.length; t++) if (d2(p, BP.P[taken[t]]) < s2) return false; return true; };
    /* the biggest groups choose first, so they get the room they need */
    const order = groups.map((q, k) => k).sort((a, b) => groups[b].m.length - groups[a].m.length || a - b);
    const placeOf = new Array(groups.length);
    order.forEach(k => {
      const q = groups[k], ap = BP.P[anchors[k]], mine = [];
      const pool = cand.map((j, x) => [j, own[x] === k ? 0 : 1, d2(BP.P[j], ap)]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
      let s2 = sep2;
      for (let pass = 0; pass < 4 && mine.length < q.m.length; pass++, s2 *= 0.6) {
        for (const [j] of pool) { if (mine.length >= q.m.length) break; if (used[j] || !free(j, s2)) continue; used[j] = 1; taken.push(j); mine.push(j); }
      }
      placeOf[k] = mine;
    });
    const clusters = groups.map((q, k) => {
      const a = anchors[k], nr = BP.N[a], lift = D * 0.35, c = W(a).map((x, ax) => x + nr[ax] * lift);
      let r = D * 0.8;
      q.m.forEach((i, x) => { const j = placeOf[k][x], p = j != null ? W(j) : c, n2 = j != null ? BP.N[j] : nr; for (let ax = 0; ax < 3; ax++) P[i * 3 + ax] = p[ax] + (j != null ? n2[ax] * lift : 0); gi[i] = k; });
      if (q.m.length) for (let ax = 0; ax < 3; ax++) c[ax] = P[q.m[0] * 3 + ax];
      q.m.forEach(i => { r = Math.max(r, Math.sqrt(d2([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], c))); });
      return { key: q.key, ac: q.ac, topic: q.topic, n: q.n, m: q.m, c, r, nrm: nr.slice() };
    });
    const R = S * 0.95;
    /* grow-in: each region from its middle outwards */
    const grow = new Float32Array(N); clusters.forEach(c => c.m.forEach(i => { grow[i] = Math.min(1, 0.12 + 0.8 * Math.sqrt(d2([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], c.c)) / Math.max(D, c.r)); }));
    const res = { P, grow, gi, clusters, R, center: [0, -0.08 * S, 0], D, S, brain: true, cols: 0 };
    if (cache.size > 8) cache.clear(); cache.set(sig, res);
    return clone(res);
  }
  /* the particles of the brain itself for drawing: world positions, normals, fold, part, region (nearest cluster on the cerebrum, else -1) */
  function shell(L, n) {
    const BP = brainPoints(n, 'shell'), S = L.S, M = BP.P.length, P = new Float32Array(M * 3), Nn = new Float32Array(M * 3), F = new Float32Array(M), reg = new Int32Array(M).fill(-1), grow = new Float32Array(M);
    const A = L.clusters.map(c => c.c.map(x => x / S));
    for (let j = 0; j < M; j++) {
      const p = BP.P[j]; P[j * 3] = p[0] * S; P[j * 3 + 1] = p[1] * S; P[j * 3 + 2] = p[2] * S; Nn.set(BP.N[j], j * 3); F[j] = BP.F[j];
      if (BP.K[j] < 2 && A.length) { let bk = -1, bd = Infinity; A.forEach((a, k) => { const dd = d2(p, a); if (dd < bd) { bd = dd; bk = k; } }); reg[j] = bk; }
      grow[j] = Math.max(0, Math.min(1, (0.85 - p[2]) / 1.75)) * 0.85;
    }
    return { P, F, K: Int8Array.from(BP.K), N: Nn, reg, grow, n: M };
  }
  const clone = r => ({ P: r.P.slice(), grow: r.grow.slice(), gi: r.gi.slice(), clusters: r.clusters.map(c => Object.assign({}, c, { c: c.c.slice(), m: c.m.slice(), nrm: c.nrm ? c.nrm.slice() : null })), R: r.R, center: r.center.slice(), D: r.D, S: r.S, brain: r.brain, cols: r.cols });

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

  const API = { layout3d, puffs, shell, brainPoints, sizeFor, PARTS, lattice, D, FLAT, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
