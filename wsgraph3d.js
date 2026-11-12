/* Birdbird – My Workspace map in 3D, core (no DOM): runs in the browser (window.WSGRAPH3D) and in node tests.
   The map is a brain made of points: every item one point, placed so the cloud forms a brain in 3D. No surface, only
   points and hairlines.
     cerebrum lobes   one per aircraft (frontal, parietal, temporal, occipital; then each lobe per hemisphere; then more
                      regions picked far apart): the aircraft at the heart, its documents nearest, then briefing packs,
                      routes and notes, spaced evenly; link lengths are shortened by swapping places
     cerebellum       'Unsorted': items with no aircraft (with no aircraft at all, they fill the whole cerebrum)
     brainstem        shape only: faint background points, never an item
   sdf(x,y,z)  the shape in unit space (x right, y up, z front; about 1.7 long), < 0 inside; S world units per unit.
   layout3d(g) -> { P: Float32Array(3N) world, grow: Float32Array(N) (0 at the base of the stem .. 1 at the far edge: the
                  grow-in on open runs outwards from the stem), clusters: [{ key, ac, n, lobe, c:[x,y,z] world, r, cb }],
                  R (world radius round the centre), center }. Deterministic; computed once, nothing is simulated later.
   dust(n, opts)  background neurons inside the brain (denser near its surface, so the silhouette reads; the stem and
                  cerebellum included), a hairline to a near neighbour now and then; opts.shell keeps them to a thin
                  layer under the surface. -> { P, grow, links }      dustCount(n, sample) -> { n, shell }
   node --test tests/wsgraph3d.test.mjs */
(function (G) {
  'use strict';
  function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function prng(seed) { let s = (seed >>> 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0; s = Math.imul(s ^ (s >>> 13), 3266489917) >>> 0; s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
  const S = 40;

  /* ---------- the shape (smooth signed distances, unit space) ---------- */
  function ell(x, y, z, cx, cy, cz, rx, ry, rz) { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz), qx = px / rx, qy = py / ry, qz = pz / rz, k1 = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1e-9; return k0 * (k0 - 1) / k1; }
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function cone(x, y, z, ax, ay, az, ra, bx, by, bz, rb) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, px = x - ax, py = y - ay, pz = z - az, l2 = dx * dx + dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / l2)), ex = px - dx * t, ey = py - dy * t, ez = pz - dz * t;
    return Math.sqrt(ex * ex + ey * ey + ez * ez) - (ra + (rb - ra) * t);
  }
  /* both hemispheres: frontal, parietal and occipital swellings, the temporal lobe low at the side with a groove above
     it, a flatter underside, and the longitudinal fissure between them */
  function cerebrum(x, y, z) {
    const ax = Math.abs(x);
    let d = ell(ax, y, z, 0.31, 0.10, -0.03, 0.36, 0.47, 0.80);
    d = smin(d, ell(ax, y, z, 0.29, 0.07, 0.40, 0.33, 0.41, 0.45), 0.10);
    d = smin(d, ell(ax, y, z, 0.27, 0.27, -0.16, 0.31, 0.33, 0.50), 0.10);
    d = smin(d, ell(ax, y, z, 0.25, 0.02, -0.56, 0.27, 0.35, 0.33), 0.10);
    d = smax(d, -(y + 0.25) - Math.max(0, z - 0.3) * 0.25, 0.14);
    d = smin(d, ell(ax, y, z, 0.47, -0.22, 0.10, 0.21, 0.19, 0.41), 0.035);
    d = smax(d, -cone(ax, y, z, 0.64, -0.10, 0.36, 0.035, 0.60, -0.02, -0.12, 0.022), 0.03);
    return smax(d, (0.03 - ax) - Math.max(0, -0.06 - y) * 1.4, 0.035);
  }
  const cerebellum = (x, y, z) => ell(x, y, z, 0, -0.36, -0.50, 0.44, 0.19, 0.28);
  const STEM_A = [0, -0.16, -0.15], STEM_B = [0, -0.94, -0.33];
  const stem = (x, y, z) => smin(cone(x, y, z, STEM_A[0], STEM_A[1], STEM_A[2], 0.12, STEM_B[0], STEM_B[1], STEM_B[2], 0.085), ell(x, y, z, 0, -0.42, -0.15, 0.15, 0.13, 0.14), 0.06);
  const sdf = (x, y, z) => smin(smin(cerebrum(x, y, z), cerebellum(x, y, z), 0.04), stem(x, y, z), 0.05);
  const BOUNDS = { x0: -0.72, x1: 0.72, y0: -0.98, y1: 0.66, z0: -0.92, z1: 0.92 };
  const CENTER = [0, -0.1, -0.04];
  const STEM_LEN = Math.hypot(STEM_B[1] - STEM_A[1], STEM_B[2] - STEM_A[2]), GMAX = STEM_LEN + 1.12;
  /* growth: up the stem from its base, then outwards from its top; 0..1 */
  function growOf(x, y, z) {
    const dx = STEM_A[0] - STEM_B[0], dy = STEM_A[1] - STEM_B[1], dz = STEM_A[2] - STEM_B[2], l2 = dx * dx + dy * dy + dz * dz;
    const t = ((x - STEM_B[0]) * dx + (y - STEM_B[1]) * dy + (z - STEM_B[2]) * dz) / l2;
    const g = t <= 1 ? Math.max(0, t) * STEM_LEN : STEM_LEN + Math.hypot(x - STEM_A[0], y - STEM_A[1], z - STEM_A[2]);
    return Math.min(1, g / GMAX);
  }

  /* ---------- places and regions ---------- */
  const LOBES = [{ id: 'frontal', a: [0.2, 0.16, 0.50] }, { id: 'parietal', a: [0.2, 0.36, -0.22] }, { id: 'temporal', a: [0.46, -0.20, 0.10] }, { id: 'occipital', a: [0.18, 0.08, -0.62] }];
  const LOBES8 = [[0.28, 0.16, 0.50], [0.28, 0.36, -0.22], [0.46, -0.20, 0.10], [0.26, 0.08, -0.62]].map((a, k) => ({ id: LOBES[k].id + '-r', a }))
    .concat([[-0.28, 0.16, 0.50], [-0.28, 0.36, -0.22], [-0.46, -0.20, 0.10], [-0.26, 0.08, -0.62]].map((a, k) => ({ id: LOBES[k].id + '-l', a })));
  const STEP = 0.04, MARGIN = 0.05;
  let pool = null;
  /* where a point may go: a jittered grid inside the shape, clear of its surface; cr cerebrum, cb cerebellum */
  function places() {
    if (pool) return pool;
    const R = prng(hash('brain3d-places')), b = BOUNDS, cr = [], cb = [];
    for (let z = b.z0; z <= b.z1; z += STEP) for (let y = b.y0; y <= b.y1; y += STEP) for (let x = b.x0; x <= b.x1; x += STEP) {
      const px = x + (R() - 0.5) * STEP * 0.7, py = y + (R() - 0.5) * STEP * 0.7, pz = z + (R() - 0.5) * STEP * 0.7;
      const dc = cerebrum(px, py, pz), db = cerebellum(px, py, pz), ds = stem(px, py, pz);
      if (db < -MARGIN * 0.6 && db < dc && ds > 0.01) cb.push([px, py, pz]);
      else if (dc < -MARGIN && db > 0.02 && ds > 0.03) cr.push([px, py, pz]);
    }
    return (pool = { cr, cb });
  }
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  function anchors(k) {
    if (k <= 4) return LOBES;
    if (k <= 8) return LOBES8;
    const P = places().cr, out = LOBES8.map(l => l.a), dmin = P.map(p => Math.min(...out.map(a => d2(a, p))));
    while (out.length < k) { let bi = 0; for (let i = 1; i < P.length; i++) if (dmin[i] > dmin[bi]) bi = i; const a = P[bi]; out.push(a); for (let i = 0; i < P.length; i++) dmin[i] = Math.min(dmin[i], d2(a, P[i])); }
    return out.map((a, i) => i < 8 ? LOBES8[i] : { id: 'region' + i, a });
  }
  const RANK = { aircraft: 0, doc: 1, pack: 2, route: 3, note: 4, notebook: 4, desk: 5, page: 6 };
  const cache = new Map();
  function layout3d(g) {
    const sig = g.nodes.map(n => n.id + '@' + n.ac).join(',') + '#' + g.links.map(l => l.s + '-' + l.t).join(',');
    const hit = cache.get(sig); if (hit) return clone(hit);
    const N = g.nodes.length, U = new Array(N), pl = places();
    const adj = g.nodes.map(() => []); g.links.forEach(l => { adj[l.s].push(l.t); adj[l.t].push(l.s); });
    const keys = [], groups = {}, free = [];
    g.nodes.forEach(n => { if (n.k === 'aircraft') { keys.push(n.id); groups[n.id] = []; } });
    g.nodes.forEach((n, i) => { if (n.ac && groups[n.ac]) groups[n.ac].push(i); else free.push(i); });
    const regs = keys.map(k => ({ key: k, ac: g.index[k], m: groups[k] }));
    const cbFree = free.length > 0 && keys.length > 0 && free.length <= Math.floor(pl.cb.length * 0.6);
    if (free.length && !cbFree) regs.push({ key: '', ac: -1, m: free, whole: !keys.length });
    const A = anchors(regs.length);
    const own = pl.cr.map(p => { let bi = 0, bd = Infinity; A.forEach((a, k) => { const q = a.id === 'temporal' ? [Math.abs(p[0]), p[1], p[2]] : p, d = d2(q, a.a); if (d < bd) { bd = d; bi = k; } }); return bi; });
    const out = [];
    const fill = (r, C, anchor, lobe) => {
      const m = r.m, n = m.length; if (!n || !C.length) return;
      let hub = C[0], hd = Infinity; for (const p of C) { const d = d2(p, anchor); if (d < hd) { hd = d; hub = p; } }
      const byD = C.slice().sort((a, b) => d2(a, hub) - d2(b, hub)), vol = C.length * STEP ** 3;
      let dd = Math.max(0.05, Math.min(0.15, 0.85 * Math.cbrt(vol / Math.max(1, n)))), pick = [];
      for (let tries = 0; tries < 30; tries++) {
        pick = []; const q = dd * dd;
        for (const p of byD) { if (pick.length >= n) break; let ok = true; for (const o of pick) if (d2(o, p) < q) { ok = false; break; } if (ok) pick.push(p); }
        if (pick.length >= n) break; dd *= 0.86;
      }
      for (const p of byD) { if (pick.length >= n) break; if (!pick.includes(p)) pick.push(p); }
      const ms = m.slice().sort((a, b) => (RANK[g.nodes[a].k] - RANK[g.nodes[b].k]) || (g.nodes[b].deg - g.nodes[a].deg) || a - b);
      ms.forEach((i, k) => { U[i] = pick[k % pick.length]; });
      const mov = ms.filter(i => i !== r.ac);
      const cost = (i, p, j, pj) => { let c = 0; for (const k of adj[i]) { const o = k === j ? pj : U[k]; if (o) c += d2(o, p); } return c; };
      if (mov.length <= 200) for (let pass = 0; pass < 8; pass++) {
        let changed = 0;
        for (let a = 0; a < mov.length; a++) for (let b = a + 1; b < mov.length; b++) {
          const i = mov[a], j = mov[b], pi = U[i], pj = U[j];
          if (cost(i, pj, j, pi) + cost(j, pi, i, pj) < cost(i, pi, j, pj) + cost(j, pj, i, pi) - 1e-9) { U[i] = pj; U[j] = pi; changed++; }
        }
        if (!changed) break;
      }
      const c = [0, 0, 0]; ms.forEach(i => { c[0] += U[i][0] / n; c[1] += U[i][1] / n; c[2] += U[i][2] / n; });
      const rr = Math.sqrt(ms.reduce((s, i) => Math.max(s, d2(U[i], c)), 0));
      out.push({ key: r.key, ac: r.ac, n, lobe, c: c.map(v => v * S), r: Math.max(0.06, rr) * S, cb: !!r.cb });
    };
    if (regs.length === 1 && regs[0].whole) fill(regs[0], pl.cr, CENTER, 'cerebrum');
    else regs.forEach((r, k) => fill(r, pl.cr.filter((p, i) => own[i] === k), A[k].a, A[k].id));
    if (cbFree) fill({ key: '', ac: -1, m: free, cb: true }, pl.cb, [0, -0.36, -0.52], 'cerebellum');
    const P = new Float32Array(N * 3), grow = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = U[i] || CENTER; P[i * 3] = p[0] * S; P[i * 3 + 1] = p[1] * S; P[i * 3 + 2] = p[2] * S; grow[i] = growOf(p[0], p[1], p[2]); }
    const res = { P, grow, clusters: out, R: 1.02 * S, center: CENTER.map(v => v * S) };
    if (cache.size > 8) cache.clear(); cache.set(sig, res);
    return clone(res);
  }
  const clone = r => ({ P: r.P.slice(), grow: r.grow.slice(), clusters: r.clusters.map(c => Object.assign({}, c, { c: c.c.slice() })), R: r.R, center: r.center.slice() });

  /* ---------- background neurons ---------- */
  const dustCache = new Map();
  function dust(n, opts) {
    opts = opts || {}; const ck = n + '|' + !!opts.shell + '|' + (opts.seed || ''); if (dustCache.has(ck)) return dustCache.get(ck);
    const R = prng(hash('dust|' + ck)), b = BOUNDS, P = new Float32Array(n * 3), grow = new Float32Array(n);
    let k = 0, guard = 0;
    while (k < n && guard++ < n * 400) {
      const x = b.x0 + R() * (b.x1 - b.x0), y = b.y0 + R() * (b.y1 - b.y0), z = b.z0 + R() * (b.z1 - b.z0), d = sdf(x, y, z);
      if (d > -0.004) continue;
      if (opts.shell ? d < -0.035 : (d < -0.06 && R() > 0.28)) continue;
      P[k * 3] = x * S; P[k * 3 + 1] = y * S; P[k * 3 + 2] = z * S; grow[k] = growOf(x, y, z); k++;
    }
    /* hairlines: to the nearest neighbour, now and then (a grid keeps it cheap) */
    const CELL = 0.09 * S, grid = new Map(), key = (a, c, e) => ((a + 512) * 1024 + (c + 512)) * 1024 + (e + 512), lk = [], seen = new Set();
    for (let i = 0; i < k; i++) { const q = key(Math.floor(P[i * 3] / CELL), Math.floor(P[i * 3 + 1] / CELL), Math.floor(P[i * 3 + 2] / CELL)); let c = grid.get(q); if (!c) grid.set(q, c = []); c.push(i); }
    const share = opts.shell ? 0.3 : 0.55;
    for (let i = 0; i < k; i++) {
      if (R() > share) continue;
      const gx = Math.floor(P[i * 3] / CELL), gy = Math.floor(P[i * 3 + 1] / CELL), gz = Math.floor(P[i * 3 + 2] / CELL); let best = -1, bd = CELL * CELL;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const c = grid.get(key(gx + ox, gy + oy, gz + oz)); if (!c) continue;
        for (const j of c) { if (j === i) continue; const d = (P[i * 3] - P[j * 3]) ** 2 + (P[i * 3 + 1] - P[j * 3 + 1]) ** 2 + (P[i * 3 + 2] - P[j * 3 + 2]) ** 2; if (d < bd) { bd = d; best = j; } }
      }
      if (best < 0) continue; const q = i < best ? i * 100000 + best : best * 100000 + i; if (seen.has(q)) continue; seen.add(q); lk.push(i, best);
    }
    const res = { P: k < n ? P.slice(0, k * 3) : P, grow: k < n ? grow.slice(0, k) : grow, links: new Uint16Array(lk) };
    dustCache.set(ck, res); return res;
  }
  /* the example: a rich field so the brain reads; your own map: a faint shell of points under the surface, so the
     silhouette is there without inventing items; a large map of your own: a fuller one */
  const dustCount = (n, sample) => sample ? { n: 1600, shell: false } : { n: n >= 120 ? 1100 : 560, shell: true };

  const API = { layout3d, dust, dustCount, sdf, cerebrum, cerebellum, stem, growOf, places, anchors, LOBES, S, CENTER, MARGIN, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
