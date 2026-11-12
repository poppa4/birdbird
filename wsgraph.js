/* Birdbird – My Workspace map, core logic (no DOM): runs in the browser (window.WSGRAPH) and in node tests.
   buildGraph   the workspace as nodes and links, only from relations already in the data:
                  document -> aircraft (acIds) · note -> aircraft / document / pack (links) · note -> cited page
                  (<cite data-doc data-p>) -> document · pack <-> route (routeId, xs.route, packId) · pack -> aircraft
                  (pack mark, else registration) · desk -> the items open in its tabs. Ink on a PDF marks its document.
                Every node is given the aircraft it gathers around (its cluster): direct links first, then the
                majority of its neighbours. Nodes with no aircraft float free.
   layout       a small force layout: springs on links, short-range repulsion through a spatial hash (no O(n²)),
                each node pulled towards its aircraft, aircraft pushed apart. It cools down and stops (settled),
                so a page can stop drawing. Start positions come from the ids, so the same workspace looks the same.
   brain        a stylised brain seen from the side (facing left): cerebrum outline, cerebellum, brain stem, two fissures,
                a faint head profile. inBrain(x, y, margin) tests a point; brainTexture(n) gives fine dust and hairlines.
   brainLayout  the example map laid out inside the brain: every node on a seeded blue-noise point in the silhouette,
                each aircraft (and the free items, in the cerebellum) owns a lobe-like wedge, its documents nearest the
                hub, then link lengths shortened by swapping places. Computed once; a short intro then it is still.
   mergeGraph   the brain is always complete: your items inside it by aircraft, the example as fading ghosts around them,
                until you have FULL items of your own (then your own force layout).
   sampleInput  a small example workspace for the empty map.
   node --test tests/wsgraph.test.mjs */
(function (G) {
  'use strict';
  const GROUPS = ['aircraft', 'doc', 'note', 'pack', 'route', 'desk'];
  const GROUP_OF = { aircraft: 'aircraft', doc: 'doc', page: 'doc', note: 'note', notebook: 'note', pack: 'pack', route: 'route', desk: 'desk' };
  const isLive = it => !!it && !it.deletedAt && !it.gone;
  const str = v => String(v == null ? '' : v).trim();
  const normReg = s => str(s).toUpperCase().replace(/[\s-]/g, '');
  const packRouteId = p => (p && (p.routeId || (p.xs && p.xs.route))) || '';

  /* page references in a note: [{ doc, p }] (each pair once) */
  function citesOf(html) {
    const out = [], seen = new Set(), re = /<cite\b([^>]*)>/gi; let m;
    while ((m = re.exec(String(html || '')))) {
      const d = /\sdata-doc="([^"]{1,100})"/.exec(m[1]), p = /\sdata-p="(\d{1,5})"/.exec(m[1]);
      if (!d || !p) continue; const k = d[1] + '#' + p[1]; if (seen.has(k)) continue; seen.add(k); out.push({ doc: d[1], p: +p[1] });
    }
    return out;
  }
  /* the tabs of a desk layout: [{ k, r }] */
  function tabsOf(L) { const out = []; (function walk(n) { if (!n) return; if (n.t === 'p') (n.tabs || []).forEach(x => x && x.k && x.r && out.push({ k: x.k, r: String(x.r) })); else (n.c || []).forEach(walk); })(L && L.root); return out; }

  const DEF_NAME = (k, o) => str(k === 'aircraft' ? (o.reg || o.type) : k === 'doc' ? o.name : (o.title || (o.f && [o.f.depapt, o.f.destapt].filter(Boolean).join(' – ')) || o.name)) || k;

  /* input { items: { id: item }, packs: [pack], routes: [route] }
     opts  { name(kind, obj) -> label, pageName(docLabel, p) -> label, packAc(pack) -> aircraft id | '', pages: true }
     -> { nodes:[{ id, k, g, r, label, ac, deg, p?, doc?, ink? }], links:[{ s, t, k }], counts:{ group: n }, own, index:{ id: i } } */
  function buildGraph(input, opts) {
    input = input || {}; opts = opts || {};
    const items = input.items || {}, name = opts.name || DEF_NAME, pages = opts.pages !== false;
    const pageName = opts.pageName || ((dl, p) => dl + ' · p. ' + p);
    const nodes = [], index = {}, links = [], lk = new Set();
    const add = (k, r, label, extra) => { const id = k + ':' + r; if (index[id] != null) return index[id]; index[id] = nodes.length; nodes.push(Object.assign({ id, k, g: GROUP_OF[k], r: String(r), label: str(label) || k, ac: '', deg: 0 }, extra || {})); return index[id]; };
    const link = (a, b, k) => { if (a == null || b == null || a === b) return; const key = a < b ? a + '-' + b : b + '-' + a; if (lk.has(key)) return; lk.add(key); links.push({ s: a, t: b, k }); nodes[a].deg++; nodes[b].deg++; };
    const at = (k, r) => index[k + ':' + r];
    const all = Object.values(items).filter(isLive);
    const of = k => all.filter(it => it.kind === k).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
    const aircraft = of('aircraft');
    aircraft.forEach(a => add('aircraft', a.id, a.mapLabel || name('aircraft', a)));
    of('doc').forEach(d => add('doc', d.id, name('doc', d)));
    of('note').forEach(n => add('note', n.id, name('note', n)));
    of('notebook').forEach(n => add('notebook', n.id, name('notebook', n)));
    const packs = (input.packs || []).filter(p => p && p.id), routes = (input.routes || []).filter(r => r && r.id);
    packs.forEach(p => add('pack', p.id, name('pack', p)));
    routes.forEach(r => add('route', r.id, name('route', r)));
    const own = nodes.length;
    /* ink on a PDF: the document is marked, it gets no node of its own */
    of('ink').forEach(x => { const i = at('doc', x.doc); if (i != null) { const n = Object.values(x.pages || {}).filter(s => s && s.length).length; if (n) nodes[i].ink = n; } });

    /* document -> aircraft */
    of('doc').forEach(d => (d.acIds || []).forEach(a => link(at('doc', d.id), at('aircraft', a), 'ac')));
    /* note -> its links, and -> the pages it cites */
    of('note').forEach(n => {
      const ni = at('note', n.id);
      (n.links || []).forEach(l => link(ni, at(l.t === 'doc' ? 'doc' : l.t, l.id), l.t === 'aircraft' ? 'ac' : 'ref'));
      citesOf(n.body).forEach(c => {
        const di = at('doc', c.doc); if (di == null) return;
        if (!pages) { link(ni, di, 'cite'); return; }
        const pi = add('page', c.doc + '#' + c.p, pageName(nodes[di].label, c.p), { doc: c.doc, p: c.p });
        link(pi, di, 'pg'); link(ni, pi, 'cite');
      });
    });
    /* pack <-> route, pack -> aircraft */
    packs.forEach(p => {
      const pi = at('pack', p.id), rid = packRouteId(p);
      if (rid) link(pi, at('route', rid), 'flight');
      let ac = opts.packAc ? opts.packAc(p) : '';
      if (!ac && !opts.packAc) { const m = items['pk:' + p.id]; if (isLive(m) && m.acId && isLive(items[m.acId])) ac = m.acId; else { const r = normReg(p.f && p.f.reg); const a = r && aircraft.find(x => normReg(x.reg) === r); if (a) ac = a.id; } }
      if (ac) link(pi, at('aircraft', ac), 'ac');
    });
    routes.forEach(r => { if (r.packId) link(at('route', r.id), at('pack', r.packId), 'flight'); });
    /* desk -> what is open in it (a desk with nothing open that is on the map gets no node) */
    of('desk').forEach(d => {
      const ids = tabsOf(d.L).map(x => at(x.k, x.r)).filter(i => i != null); if (!ids.length) return;
      const di = add('desk', d.id, name('desk', d)); ids.forEach(i => link(di, i, 'desk'));
    });

    /* clusters: an aircraft is its own; then direct aircraft links; then the majority of neighbours (desks never lend theirs) */
    const adj = nodes.map(() => []); links.forEach(l => { adj[l.s].push(l.t); adj[l.t].push(l.s); });
    const pick = (i, from) => { const c = {}; let best = '', bn = 0; adj[i].forEach(j => { const a = from(j); if (!a) return; c[a] = (c[a] || 0) + 1; if (c[a] > bn) { bn = c[a]; best = a; } }); return best; };
    nodes.forEach((n, i) => { if (n.k === 'aircraft') n.ac = n.id; });
    nodes.forEach((n, i) => { if (!n.ac) n.ac = pick(i, j => nodes[j].k === 'aircraft' ? nodes[j].id : ''); });
    for (let round = 0; round < 4; round++) {
      let changed = false; const next = nodes.map((n, i) => n.ac || pick(i, j => nodes[j].k === 'desk' ? '' : nodes[j].ac));
      next.forEach((a, i) => { if (a && !nodes[i].ac) { nodes[i].ac = a; changed = true; } });
      if (!changed) break;
    }
    const counts = {}; GROUPS.forEach(g => { counts[g] = 0; });
    nodes.forEach(n => { if (n.k !== 'page') counts[n.g]++; });
    counts.page = nodes.filter(n => n.k === 'page').length;
    return { nodes, links, counts, own, index };
  }

  /* ---------- layout ---------- */
  function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const rnd = (s, salt) => (hash(s + '|' + salt) % 100000) / 100000;
  const REST = { ac: 74, ref: 52, cite: 34, pg: 16, flight: 26, desk: 120 };
  const PULL = { ac: 0.05, ref: 0.035, cite: 0.05, pg: 0.09, flight: 0.06, desk: 0.004 };
  const SIZE = { aircraft: 3.2, doc: 1.6, page: 0.6, note: 1, notebook: 1.1, pack: 1.4, route: 1.3, desk: 1.6 };
  /* graph -> { n, x, y, settled, alpha, steps, step(k) -> still moving, run(max), reheat(a), fix(i, x, y), free(i), bounds() } */
  function layout(g, opts) {
    opts = opts || {};
    const N = g.nodes.length, x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
    const fx = new Float64Array(N), fy = new Float64Array(N), fixed = new Uint8Array(N), ci = new Int32Array(N).fill(-1);
    const acs = g.nodes.map((n, i) => n.k === 'aircraft' ? i : -1).filter(i => i >= 0);
    g.nodes.forEach((n, i) => { if (n.ac && g.index[n.ac] != null) ci[i] = g.index[n.ac]; });
    const R0 = acs.length > 1 ? 70 + 32 * acs.length : 0;
    acs.forEach((i, k) => { const a = k / acs.length * Math.PI * 2 - Math.PI / 2 + rnd(g.nodes[i].id, 'a') * 0.3; x[i] = Math.cos(a) * R0; y[i] = Math.sin(a) * R0 * 0.78; });
    const prev = opts.prev || null;
    g.nodes.forEach((n, i) => {
      if (prev && prev[n.id]) { x[i] = prev[n.id][0]; y[i] = prev[n.id][1]; return; }
      if (n.k === 'aircraft') return;
      const a = rnd(n.id, 'x') * Math.PI * 2, r = 26 + rnd(n.id, 'y') * 90;
      const c = ci[i] >= 0 ? ci[i] : -1, ox = c >= 0 ? x[c] : 0, oy = c >= 0 ? y[c] : 0, rr = c >= 0 ? r : r + R0 * 0.35 + 60;
      x[i] = ox + Math.cos(a) * rr; y[i] = oy + Math.sin(a) * rr;
    });
    const sz = g.nodes.map(n => SIZE[n.k] || 1);
    const CELL = 64, CUT2 = CELL * CELL, REP = 420;
    const st = { n: N, x, y, alpha: prev ? 0.5 : 1, settled: N === 0, steps: 0 };
    const grid = new Map();
    function step() {
      const al = st.alpha; fx.fill(0); fy.fill(0);
      /* short-range repulsion through a spatial hash: each pair once (same cell + 4 forward neighbours) */
      grid.clear();
      for (let i = 0; i < N; i++) { const k = Math.floor(x[i] / CELL) + ',' + Math.floor(y[i] / CELL); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); }
      const pair = (i, j) => {
        let dx = x[i] - x[j], dy = y[i] - y[j], d2 = dx * dx + dy * dy;
        if (d2 > CUT2) return; if (d2 < 0.01) { dx = (rnd(i, j) - 0.5) || 0.1; dy = (rnd(j, i) - 0.5) || 0.1; d2 = dx * dx + dy * dy; }
        const f = REP * al * (sz[i] + sz[j]) * 0.5 / Math.max(d2, 9) * (1 - d2 / CUT2);
        const d = Math.sqrt(d2), ux = dx / d * f, uy = dy / d * f; fx[i] += ux; fy[i] += uy; fx[j] -= ux; fy[j] -= uy;
      };
      grid.forEach((c, k) => {
        const cm = k.indexOf(','), gx = +k.slice(0, cm), gy = +k.slice(cm + 1);
        for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) pair(c[a], c[b]);
        [[1, 0], [-1, 1], [0, 1], [1, 1]].forEach(([ox, oy]) => { const o = grid.get((gx + ox) + ',' + (gy + oy)); if (o) for (const i of c) for (const j of o) pair(i, j); });
      });
      /* aircraft keep their distance (few, so every pair) */
      for (let a = 0; a < acs.length; a++) for (let b = a + 1; b < acs.length; b++) {
        const i = acs[a], j = acs[b]; let dx = x[i] - x[j], dy = y[i] - y[j]; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const want = 90 + 15 * Math.sqrt(N / Math.max(1, acs.length)); if (d >= want * 1.3) continue;
        const f = al * 0.08 * (want * 1.3 - d); fx[i] += dx / d * f; fy[i] += dy / d * f; fx[j] -= dx / d * f; fy[j] -= dy / d * f;
      }
      /* springs */
      for (const l of g.links) {
        const i = l.s, j = l.t, dx = x[j] - x[i], dy = y[j] - y[i], d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - (REST[l.k] || 50)) * (PULL[l.k] || 0.04) * al, ux = dx / d * f, uy = dy / d * f;
        const wi = sz[j] / (sz[i] + sz[j]), wj = 1 - wi;
        fx[i] += ux * wi * 2; fy[i] += uy * wi * 2; fx[j] -= ux * wj * 2; fy[j] -= uy * wj * 2;
      }
      /* gravity: aircraft towards the middle, the rest towards their aircraft, free nodes gently towards the middle */
      for (let i = 0; i < N; i++) {
        const c = ci[i];
        if (g.nodes[i].k === 'aircraft') { fx[i] -= x[i] * 0.012 * al; fy[i] -= y[i] * 0.016 * al; }
        else if (c >= 0) { fx[i] += (x[c] - x[i]) * 0.012 * al; fy[i] += (y[c] - y[i]) * 0.012 * al; }
        else { fx[i] -= x[i] * 0.004 * al; fy[i] -= y[i] * 0.005 * al; }
      }
      let mv = 0;
      for (let i = 0; i < N; i++) {
        if (fixed[i]) { vx[i] = vy[i] = 0; continue; }
        vx[i] = (vx[i] + fx[i]) * 0.58; vy[i] = (vy[i] + fy[i]) * 0.58;
        const s = Math.hypot(vx[i], vy[i]); if (s > 14) { vx[i] *= 14 / s; vy[i] *= 14 / s; }
        x[i] += vx[i]; y[i] += vy[i]; if (s > mv) mv = s;
      }
      st.alpha *= 0.986; st.steps++;
      if (st.alpha < 0.006 || (st.steps > 80 && mv < 0.015)) { st.settled = true; vx.fill(0); vy.fill(0); }
      return mv;
    }
    st.step = k => { if (st.settled) return false; for (let s = 0; s < (k || 1) && !st.settled; s++) step(); return !st.settled; };
    st.run = max => { let n = 0; while (!st.settled && n < (max || 800)) { step(); n++; } st.settled = true; return n; };
    st.reheat = a => { st.alpha = Math.max(st.alpha, Math.min(1, a || 0.3)); st.settled = N === 0; };
    st.fix = (i, px, py) => { fixed[i] = 1; x[i] = px; y[i] = py; };
    st.free = i => { fixed[i] = 0; };
    st.bounds = idx => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; (idx || g.nodes.map((n, i) => i)).forEach(i => { if (x[i] < a) a = x[i]; if (x[i] > c) c = x[i]; if (y[i] < b) b = y[i]; if (y[i] > d) d = y[i]; }); return a === Infinity ? { x0: -1, y0: -1, x1: 1, y1: 1 } : { x0: a, y0: b, x1: c, y1: d }; };
    st.positions = () => { const o = {}; g.nodes.forEach((n, i) => { o[n.id] = [x[i], y[i]]; }); return o; };
    return st;
  }

  /* ---------- the brain (unit coordinates, x right, y down, facing left) ---------- */
  function prng(seed) { let s = (seed >>> 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0; s = Math.imul(s ^ (s >>> 13), 3266489917) >>> 0; s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
  /* closed (or open) Catmull-Rom through control points -> dense polyline */
  function smooth(P, closed, per) {
    const out = [], n = P.length, at = k => closed ? P[(k + n) % n] : P[Math.max(0, Math.min(n - 1, k))];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < per; s++) { const u = s / per, u2 = u * u, u3 = u2 * u;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]); }
    }
    if (!closed) out.push(P[n - 1].slice());
    return out;
  }
  const BRAIN = (function () {
    const cerebrum = smooth([[-0.80, 0.17], [-0.95, -0.06], [-0.92, -0.37], [-0.71, -0.63], [-0.37, -0.78], [0.03, -0.81], [0.42, -0.73], [0.72, -0.53], [0.91, -0.23], [0.95, 0.05], [0.84, 0.21], [0.58, 0.25], [0.32, 0.29], [0.10, 0.41], [-0.20, 0.47], [-0.45, 0.42], [-0.55, 0.28], [-0.69, 0.24]], true, 10);
    const cb = { cx: 0.57, cy: 0.345, rx: 0.29, ry: 0.15, rot: -0.14 };
    const cerebellum = []; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, ex = Math.cos(a) * cb.rx, ey = Math.sin(a) * cb.ry; cerebellum.push([cb.cx + ex * Math.cos(cb.rot) - ey * Math.sin(cb.rot), cb.cy + ex * Math.sin(cb.rot) + ey * Math.cos(cb.rot)]); }
    const stem = smooth([[0.14, 0.38], [0.22, 0.52], [0.25, 0.70], [0.23, 0.86]], false, 8), stem2 = smooth([[0.32, 0.36], [0.37, 0.50], [0.36, 0.70], [0.34, 0.86]], false, 8);
    const fissures = [smooth([[0.06, -0.80], [0.02, -0.58], [-0.08, -0.40], [-0.10, -0.22], [-0.18, -0.04]], false, 8), /* central */
      smooth([[-0.56, 0.24], [-0.36, 0.13], [-0.12, 0.08], [0.12, 0.02], [0.34, -0.08]], false, 8), /* lateral */
      smooth([[0.62, -0.60], [0.56, -0.40], [0.66, -0.20]], false, 8)];
    const folia = [-0.06, 0, 0.06].map(d => smooth([[0.36, 0.34 + d], [0.53, 0.30 + d * 1.2], [0.73, 0.29 + d], [0.83, 0.32 + d * 0.6]], false, 6));
    const head = smooth([[0.62, 1.55], [0.74, 1.02], [1.06, 0.62], [1.20, 0.10], [1.10, -0.55], [0.66, -0.98], [0.02, -1.10], [-0.62, -1.00], [-1.03, -0.66], [-1.20, -0.22], [-1.22, 0.06], [-1.18, 0.17], [-1.25, 0.32], [-1.43, 0.63], [-1.31, 0.72], [-1.28, 0.79], [-1.33, 0.89], [-1.27, 0.96], [-1.31, 1.03], [-1.22, 1.10], [-1.25, 1.22], [-1.10, 1.33], [-0.78, 1.36], [-0.62, 1.44], [-0.58, 1.75]], false, 8);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; cerebrum.concat(cerebellum).forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return { cerebrum, cerebellum, cb, stem: [stem, stem2], fissures, folia, head, bounds: { x0, y0, x1, y1 }, core: [-0.04, -0.16] };
  })();
  function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function edgeDist(P, x, y) { let m = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[j], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9; const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), ex = a[0] + dx * u - x, ey = a[1] + dy * u - y; m = Math.min(m, ex * ex + ey * ey); } return Math.sqrt(m); }
  const inCerebellum = (x, y, m) => { const c = BRAIN.cb, dx = x - c.cx, dy = y - c.cy, ex = dx * Math.cos(-c.rot) - dy * Math.sin(-c.rot), ey = dx * Math.sin(-c.rot) + dy * Math.cos(-c.rot), rx = c.rx - (m || 0), ry = c.ry - (m || 0); return rx > 0 && ry > 0 && (ex * ex) / (rx * rx) + (ey * ey) / (ry * ry) <= 1; };
  const inCerebrum = (x, y, m) => inPoly(BRAIN.cerebrum, x, y) && (!m || edgeDist(BRAIN.cerebrum, x, y) >= m);
  const inBrain = (x, y, m) => inCerebrum(x, y, m) || inCerebellum(x, y, m);
  /* best-candidate blue noise inside a region */
  function scatter(n, inside, R, have, tries, box) {
    const out = [], b = box || BRAIN.bounds;
    for (let k = 0; k < n; k++) {
      let best = null, bd = -1;
      for (let c = 0; c < tries; c++) {
        let x, y, g = 0; do { x = b.x0 + R() * (b.x1 - b.x0); y = b.y0 + R() * (b.y1 - b.y0); } while (!inside(x, y) && ++g < 400);
        let d = Infinity; for (const p of have) { const e = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (e < d) d = e; } for (const p of out) { const e = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (e < d) d = e; }
        if (d > bd) { bd = d; best = [x, y]; }
      }
      out.push(best);
    }
    return out;
  }
  /* fine dust and hairlines that give the silhouette its texture: { pts:[[x,y]], links:[[i,j]] } (cached per n) */
  const texCache = {};
  function brainTexture(n) {
    n = n || 520; if (texCache[n]) return texCache[n];
    const R = prng(hash('brain-texture|' + n)), pts = scatter(n, (x, y) => inBrain(x, y), R, [], 3), links = [], seen = new Set();
    pts.forEach((p, i) => {
      const near = []; /* the 2 or 3 nearest */
      for (let j = 0; j < pts.length; j++) { if (j === i) continue; const e = (pts[j][0] - p[0]) ** 2 + (pts[j][1] - p[1]) ** 2; if (near.length < 3 || e < near[near.length - 1][1]) { near.push([j, e]); near.sort((a, b) => a[1] - b[1]); if (near.length > 3) near.pop(); } }
      near.slice(0, 2 + (i % 2)).forEach(([j, e]) => { if (e > 0.012) return; const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); links.push([i, j]); } });
    });
    return (texCache[n] = { pts, links });
  }
  /* the example map inside the brain. -> the same interface as layout(), with tx/ty (targets), unit S, frame */
  /* opt (the merged map): key(i) -> the lobe a node belongs to ('' = free), pri(i) -> 0 your own, 1 an example ghost.
     Within a lobe your own items take the places nearest its middle, ghosts the rest; swaps never mix the two. */
  function brainSlots(g, R, opt) {
    opt = opt || {};
    const N = g.nodes.length, U = new Array(N), pri = opt.pri || (() => 0);
    const keyOf = opt.key || (i => { const n = g.nodes[i]; return n.ac && g.index[n.ac] != null ? n.ac : ''; });
    const adj = g.nodes.map(() => []); g.links.forEach(l => { adj[l.s].push(l.t); adj[l.t].push(l.s); });
    /* clusters: aircraft in their order, then the free items */
    const keys = [], groups = {};
    g.nodes.forEach((n, i) => { const k = keyOf(i); if (!groups[k]) { groups[k] = []; if (k) keys.push(k); } groups[k].push(i); });
    if (opt.key) keys.sort();
    const free = groups[''] || [], q = Math.min(free.length, Math.round(N * 0.12));
    const cbPts = scatter(q, (a, b) => inCerebellum(a, b, 0.03), R, [], 14);
    const crPts = scatter(N - q, (a, b) => inCerebrum(a, b, 0.035), R, cbPts, 14);
    const place = (members, slots) => {
      if (!members.length) return;
      const cx = slots.reduce((s, p) => s + p[0], 0) / slots.length, cy = slots.reduce((s, p) => s + p[1], 0) / slots.length;
      const hub = members.slice().sort((a, b) => pri(a) - pri(b) || a - b).find(i => g.nodes[i].k === 'aircraft');
      const order = slots.slice().sort((a, b) => ((a[0] - cx) ** 2 + (a[1] - cy) ** 2) - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2));
      const rank = { aircraft: 0, doc: 1, pack: 2, route: 3, note: 4, notebook: 4, desk: 5, page: 6 };
      const ms = members.slice().sort((a, b) => (pri(a) - pri(b)) || (rank[g.nodes[a].k] - rank[g.nodes[b].k]) || (g.nodes[b].deg - g.nodes[a].deg) || a - b);
      ms.forEach((i, k) => { U[i] = order[k]; });
      /* shorten links: swap places inside the cluster while it helps (the hub stays) */
      const mov = ms.filter(i => i !== hub), cost = (i, p, j, pj) => { let c = 0; for (const k of adj[i]) { const o = k === j ? pj : U[k]; if (o) c += (o[0] - p[0]) ** 2 + (o[1] - p[1]) ** 2; } return c; };
      for (let pass = 0; pass < 14; pass++) {
        let changed = 0;
        for (let a = 0; a < mov.length; a++) for (let b = a + 1; b < mov.length; b++) {
          const i = mov[a], j = mov[b], pi = U[i], pj = U[j]; if (pri(i) !== pri(j)) continue;
          const now = cost(i, pi, j, pj) + cost(j, pj, i, pi), then = cost(i, pj, j, pi) + cost(j, pi, i, pj);
          if (then < now - 1e-9) { U[i] = pj; U[j] = pi; changed++; }
        }
        if (!changed) break;
      }
    };
    /* the cerebellum for the free items (as many as fit), the cerebrum in wedges around its middle */
    const fb = free.slice().sort((a, b) => pri(a) - pri(b) || g.nodes[b].deg - g.nodes[a].deg || a - b), inCb = fb.slice(0, q), rest = fb.slice(q);
    place(inCb, cbPts);
    const lists = keys.map(k => groups[k]); if (rest.length) lists.push(rest);
    const mx = crPts.reduce((s, p) => s + p[0], 0) / (crPts.length || 1), my = crPts.reduce((s, p) => s + p[1], 0) / (crPts.length || 1);
    const ang = p => { let a = Math.atan2(p[1] - my, p[0] - mx) - Math.PI * 0.62; while (a < 0) a += Math.PI * 2; return a; };
    const sorted = crPts.slice().sort((a, b) => ang(a) - ang(b)); let at = 0;
    lists.forEach(m => { place(m, sorted.slice(at, at + m.length)); at += m.length; });
    return U;
  }
  const brainCache = new Map();
  function brainLayout(g, opts) {
    opts = opts || {};
    const N = g.nodes.length, S = opts.scale || 240, x = new Float64Array(N), y = new Float64Array(N), tx = new Float64Array(N), ty = new Float64Array(N), x0 = new Float64Array(N), y0 = new Float64Array(N);
    const R = prng(hash('brain|' + N + '|' + g.links.length)), sig = g.nodes.map(n => n.id).join(',') + '#' + g.links.map(l => l.s + '-' + l.t).join(',');
    let U = g.slots || brainCache.get(sig); if (!U) { U = brainSlots(g, R); if (brainCache.size > 8) brainCache.clear(); brainCache.set(sig, U); }
    const c = BRAIN.core;
    for (let i = 0; i < N; i++) { const p = U[i] || c; tx[i] = p[0] * S; ty[i] = p[1] * S; const j = 0.32 + R() * 0.2; x0[i] = x[i] = (c[0] + (p[0] - c[0]) * j) * S; y0[i] = y[i] = (c[1] + (p[1] - c[1]) * j) * S; }
    const INTRO = 64, b = BRAIN.bounds;
    const st = { n: N, x, y, tx, ty, S, alpha: 0, settled: false, steps: 0, brain: true, frame: { x0: b.x0 * S, y0: b.y0 * S, x1: b.x1 * S, y1: b.y1 * S } };
    const at2 = p => { const e = 1 - Math.pow(1 - p, 3); if (p >= 1) { x.set(tx); y.set(ty); return; } for (let i = 0; i < N; i++) { x[i] = x0[i] + (tx[i] - x0[i]) * e; y[i] = y0[i] + (ty[i] - y0[i]) * e; } };
    st.step = k => { if (st.settled) return false; st.steps += k || 1; const p = Math.min(1, st.steps / INTRO); at2(p); if (p >= 1) st.settled = true; return !st.settled; };
    st.run = () => { at2(1); st.settled = true; return 0; };
    if (opts.instant || N === 0) st.run();
    st.reheat = () => {}; st.fix = (i, px, py) => { x[i] = px; y[i] = py; }; st.free = () => {};
    st.bounds = idx => { let a = Infinity, bb = Infinity, cc = -Infinity, d = -Infinity; (idx || g.nodes.map((n, i) => i)).forEach(i => { if (x[i] < a) a = x[i]; if (x[i] > cc) cc = x[i]; if (y[i] < bb) bb = y[i]; if (y[i] > d) d = y[i]; }); return a === Infinity ? { x0: -1, y0: -1, x1: 1, y1: 1 } : { x0: a, y0: bb, x1: cc, y1: d }; };
    st.positions = () => { const o = {}; g.nodes.forEach((n, i) => { o[n.id] = [x[i], y[i]]; }); return o; };
    return st;
  }

  /* ---------- the merged map: the brain is always complete, your own items light it up ----------
     own (buildGraph of the workspace) + sample (buildGraph of sampleInput) -> one graph laid out in the brain:
     your nodes (ghost: false) in the lobes of their aircraft (aircraft k -> lobe k of the example; items without an
     aircraft in the cerebellum), the example nodes as ghosts (ghost: true) filling the rest. Ghosts shown:
     round(example size × (1 − own / full)); the ones nearest your nodes go first. counts are yours (the example's when
     you have none). slots: each node's place in unit brain coordinates (brainLayout uses them).
     With own items >= full the own graph is returned as it is (its force layout). Cached per input. */
  const FULL = 40, mergeCache = new Map();
  const sigOf = g => g.nodes.map(n => n.id + '=' + n.label + '@' + n.ac + (n.ink ? '*' : '')).join('|') + '#' + g.links.map(l => l.s + '-' + l.t).join(',');
  function mergeGraph(own, sample, opts) {
    opts = opts || {}; const full = opts.full || FULL;
    if (!sample || !own || own.own >= full) return own;
    const ck = sigOf(own) + '§' + sigOf(sample) + '§' + full, hit = mergeCache.get(ck); if (hit) return hit;
    const No = own.nodes.length, Ns = sample.nodes.length;
    const nodes = own.nodes.map(n => Object.assign({}, n, { ghost: false }))
      .concat(sample.nodes.map(n => Object.assign({}, n, { id: 'ex:' + n.id, ac: n.ac ? 'ex:' + n.ac : '', ghost: true })));
    const index = {}; nodes.forEach((n, i) => { index[n.id] = i; });
    const links = own.links.map(l => ({ s: l.s, t: l.t, k: l.k })).concat(sample.links.map(l => ({ s: l.s + No, t: l.t + No, k: l.k })));
    /* lobes: the example's aircraft in order; your aircraft k shares lobe k (wrapping) */
    const lobe = {}, sAc = nodes.filter(n => n.ghost && n.k === 'aircraft'), oAc = nodes.filter(n => !n.ghost && n.k === 'aircraft'), nL = Math.max(1, sAc.length);
    sAc.forEach((n, k) => { lobe[n.id] = k; }); oAc.forEach((n, k) => { lobe[n.id] = k % nL; });
    const key = i => { const a = nodes[i].ac; return a && lobe[a] != null ? 'L' + String(lobe[a]).padStart(3, '0') : ''; };
    const R = prng(hash('brain|' + nodes.length + '|' + links.length));
    const U = brainSlots({ nodes, links, index }, R, { key, pri: i => nodes[i].ghost ? 1 : 0 });
    /* which ghosts stay: the farthest from your nodes */
    const keepN = own.own === 0 ? Ns : Math.max(0, Math.min(Ns, Math.round(Ns * (1 - own.own / full))));
    const gd = []; for (let i = No; i < nodes.length; i++) { let d = Infinity; const p = U[i]; for (let j = 0; j < No; j++) { const q = U[j], e = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (e < d) d = e; } gd.push([i, d]); }
    gd.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const keep = new Set(gd.slice(0, keepN).map(x => x[0])), map = new Int32Array(nodes.length).fill(-1), out = [], slots = [];
    nodes.forEach((n, i) => { if (i < No || keep.has(i)) { map[i] = out.length; out.push(n); slots.push(U[i]); } });
    const outLinks = links.filter(l => map[l.s] >= 0 && map[l.t] >= 0).map(l => ({ s: map[l.s], t: map[l.t], k: l.k }));
    out.forEach(n => { if (n.ghost) n.deg = 0; }); outLinks.forEach(l => { if (out[l.s].ghost) out[l.s].deg++; if (out[l.t].ghost) out[l.t].deg++; });
    const oi = {}; out.forEach((n, i) => { oi[n.id] = i; });
    const res = { nodes: out, links: outLinks, counts: Object.assign({}, own.own ? own.counts : sample.counts), own: own.own, index: oi,
      merged: true, ghosts: out.length - No, full, fade: Math.min(1, own.own / full), slots };
    if (mergeCache.size > 6) mergeCache.clear(); mergeCache.set(ck, res);
    return res;
  }

  /* ---------- an example workspace for the empty map ---------- */
  function sampleInput(t) {
    t = t || ((en) => en);
    const items = {}, now = 1700000000000; let seq = 0;
    const put = o => { o.createdAt = now + seq++; o.updatedAt = o.createdAt; items[o.id] = o; return o; };
    const ac = [put({ id: 'xa1', kind: 'aircraft', type: 'Diamond DA42', reg: 'LN-EXA', mapLabel: 'DA42 — ME/IR' }),
      put({ id: 'xa2', kind: 'aircraft', type: 'Beechcraft B200', reg: 'LN-EXB', mapLabel: t('B200 — type rating', 'B200 — typeberettigelse') }),
      put({ id: 'xa3', kind: 'aircraft', type: 'Cessna 172', reg: 'LN-EXC', mapLabel: 'C172 — PPL' })];
    const dn = [['AFM', 0, 'afm'], [t('Checklist', 'Sjekkliste'), 0, 'chk'], ['SOP', 0, 'sop'], [t('Limitations', 'Begrensninger'), 0, 'afm'],
      ['AFM', 1, 'afm'], ['QRH', 1, 'chk'], ['SOP', 1, 'sop'], ['POH', 2, 'afm'], [t('Checklist', 'Sjekkliste'), 2, 'chk'],
      [t('Training manual', 'Treningsmanual'), -1, 'company'], ['Part-FCL', -1, 'company']];
    const docs = dn.map(([n, a, cat], i) => put({ id: 'xd' + i, kind: 'doc', name: n + (a >= 0 ? ' ' + ac[a].type.split(' ')[1] : ''), cat, acIds: a >= 0 ? [ac[a].id] : [] }));
    const topics = [[t('Engine failure after take-off', 'Motorsvikt etter avgang'), 0], [t('Single-engine approach', 'Enmotors innflyging'), 2], ['VMCA', 3], [t('Fuel planning', 'Drivstoffplanlegging'), 0], [t('Icing', 'Ising'), 3], [t('Approach briefing', 'Innflygingsbrief'), 1], [t('Go-around', 'Avbrutt landing'), 2], ['ILS', 1],
      [t('Pressurisation', 'Trykkabin'), 4], [t('Engine fire', 'Motorbrann'), 5], [t('Autopilot', 'Autopilot'), 4], [t('Crew briefing', 'Besetningsbrief'), 6], [t('Electrical failure', 'Elektrisk svikt'), 5], [t('Performance', 'Ytelse'), 4],
      [t('Stall recovery', 'Steile'), 7], [t('Crosswind landing', 'Sidevindslanding'), 8], [t('Circuit', 'Landingsrunde'), 8], [t('Short field', 'Kortbane'), 7], [t('Weight and balance', 'Masse og balanse'), 7],
      [t('Holding entries', 'Ventemønster'), 9], [t('Night VFR', 'Natt-VFR'), 9], [t('Licence privileges', 'Sertifikatrettigheter'), 10], [t('Weather minima', 'Værminima'), 9]];
    topics.forEach(([n, di], i) => {
      const d = docs[di], a = (d.acIds || [])[0];
      const cites = [1 + (i * 7) % 40, 2 + (i * 5) % 14].map(p => `<cite data-doc="${d.id}" data-p="${p}">${d.name} p. ${p}</cite>`).join(' ');
      put({ id: 'xn' + i, kind: 'note', title: n, body: '<div>' + cites + '</div>', links: a ? [{ t: 'aircraft', id: a }] : [] });
    });
    const packs = [['ENTO', 'ENBR', 'LN-EXA'], ['ENTO', 'ENGM', 'LN-EXA'], ['ENGM', 'ENVA', 'LN-EXB'], ['ENGM', 'ENZV', 'LN-EXB'], ['ENRY', 'ENCN', 'LN-EXC']].map((x, i) => ({ id: 'xp' + i, title: x[0] + ' – ' + x[1], f: { depapt: x[0], destapt: x[1], reg: x[2] }, routeId: 'xr' + i }));
    const routes = packs.map((p, i) => ({ id: 'xr' + i, title: p.title, packId: p.id, pts: [{ n: p.f.depapt, t: 'rwy' }, { n: p.f.destapt, t: 'rwy' }] }));
    return { items, packs, routes };
  }

  const API = { GROUPS, GROUP_OF, citesOf, tabsOf, buildGraph, layout, brainLayout, brainTexture, inBrain, BRAIN, sampleInput, mergeGraph, FULL, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH = API;
})(typeof window !== 'undefined' ? window : globalThis);
