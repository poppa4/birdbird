/* Birdbird – My Workspace map in 3D, core (no DOM): runs in the browser (window.WSGRAPH3D) and in node tests.
   The map is a cloud: every group (an aircraft, a topic, then 'Unsorted') a soft ball of evenly spaced points, slightly flattened
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
  function layout3d(g, opts) {
    opts = opts || {}; const aspect = opts.aspect || 1.7;
    const sig = aspect.toFixed(2) + '|' + g.nodes.map(n => n.id + '@' + n.ac).join(',') + '|' + (g.topics || []).map(x => x.id + '=' + x.name).join(',');
    const hit = cache.get(sig); if (hit) return clone(hit);
    const N = g.nodes.length, groups = GW.groupsOf(g), P = new Float32Array(N * 3), gi = new Int32Array(N).fill(-1);
    const balls = groups.map(q => {
      const pts = lattice(q.m.length).slice(0, q.m.length), rot = (hash('rot|' + (q.key || '~')) % 1000) / 1000 * Math.PI * 2, c = Math.cos(rot), s = Math.sin(rot);
      const at = pts.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]);
      return { at, r: Math.max(D * 0.8, Math.sqrt(at.reduce((m, p) => Math.max(m, p[0] * p[0] + p[1] * p[1] + p[2] * p[2]), 0))) };
    });
    const A = GW.arrange(balls.map(b => b.r), aspect, D * 1.8, D * 1.4);
    const clusters = groups.map((q, k) => {
      const [ax, ay] = A.c[k], cz = (((hash('z|' + (q.key || '~')) % 1000) / 1000) - 0.5) * balls[k].r * 0.7, cc = [ax, -ay, cz];
      q.m.forEach((i, j) => { const p = balls[k].at[j]; P[i * 3] = cc[0] + p[0]; P[i * 3 + 1] = cc[1] + p[1]; P[i * 3 + 2] = cc[2] + p[2]; gi[i] = k; });
      return { key: q.key, ac: q.ac, topic: q.topic, n: q.n, m: q.m, c: cc, r: balls[k].r };
    });
    let R = 0; clusters.forEach(c => { R = Math.max(R, Math.hypot(c.c[0], c.c[1], c.c[2]) + c.r + D * 1.5); });
    const grow = new Float32Array(N); for (let i = 0; i < N; i++) grow[i] = Math.min(1, Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) / Math.max(1, R));
    const res = { P, grow, gi, clusters, R: Math.max(R, D * 4), center: [0, 0, 0], D, cols: A.cols };
    if (cache.size > 8) cache.clear(); cache.set(sig, res);
    return clone(res);
  }
  const clone = r => ({ P: r.P.slice(), grow: r.grow.slice(), gi: r.gi.slice(), clusters: r.clusters.map(c => Object.assign({}, c, { c: c.c.slice(), m: c.m.slice() })), R: r.R, center: r.center.slice(), D: r.D, cols: r.cols });

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

  const API = { layout3d, puffs, lattice, D, FLAT, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH3D = API;
})(typeof window !== 'undefined' ? window : globalThis);
