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
    aircraft.forEach(a => add('aircraft', a.id, name('aircraft', a)));
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

  /* ---------- an example workspace for the empty map ---------- */
  function sampleInput(t) {
    t = t || ((en) => en);
    const items = {}, now = 1700000000000; let seq = 0;
    const put = o => { o.createdAt = now + seq++; o.updatedAt = o.createdAt; items[o.id] = o; return o; };
    const ac = [put({ id: 'xa1', kind: 'aircraft', type: 'Diamond DA42', reg: 'LN-EXA' }), put({ id: 'xa2', kind: 'aircraft', type: 'Cessna 172', reg: 'LN-EXB' })];
    const dn = [['AFM', 0, 'afm'], [t('Checklist', 'Sjekkliste'), 0, 'chk'], ['SOP', 0, 'sop'], [t('Limitations', 'Begrensninger'), 0, 'afm'], ['POH', 1, 'afm'], [t('Checklist', 'Sjekkliste'), 1, 'chk'], [t('Training manual', 'Treningsmanual'), -1, 'company'], [t('Charts', 'Kart'), -1, 'charts']];
    const docs = dn.map(([n, a, cat], i) => put({ id: 'xd' + i, kind: 'doc', name: n + (a >= 0 ? ' ' + ac[a].type.split(' ')[1] : ''), cat, acIds: a >= 0 ? [ac[a].id] : [] }));
    const topics = [t('Engine failure after take-off', 'Motorsvikt etter avgang'), t('Single-engine approach', 'Enmotors innflyging'), 'VMCA', t('Fuel planning', 'Drivstoffplanlegging'), t('Icing', 'Ising'), t('Stall recovery', 'Steile'), t('Crosswind landing', 'Sidevindslanding'), t('Go-around', 'Avbrutt landing'), t('Weight and balance', 'Masse og balanse'), t('Holding entries', 'Ventemønster'), t('Night VFR', 'Natt-VFR'), t('Radio failure', 'Radiosvikt'), t('Electrical failure', 'Elektrisk svikt'), t('Approach briefing', 'Innflygingsbrief'), t('Circuit', 'Landingsrunde'), t('Short field', 'Kortbane'), t('Performance', 'Ytelse'), t('Weather minima', 'Værminima')];
    topics.forEach((n, i) => {
      const d = docs[[0, 0, 3, 2, 0, 4, 4, 1, 4, 6, 6, 2, 0, 1, 5, 4, 0, 7][i]], a = (d.acIds || [])[0];
      const cites = [1 + (i * 7) % 40, 1 + (i * 3) % 12].map(p => `<cite data-doc="${d.id}" data-p="${p}">${d.name} p. ${p}</cite>`).join(' ');
      put({ id: 'xn' + i, kind: 'note', title: n, body: '<div>' + cites + '</div>', links: a ? [{ t: 'aircraft', id: a }] : [] });
    });
    const packs = [['ENTO', 'ENBR', 'LN-EXA', 'xr0'], ['ENTO', 'ENGM', 'LN-EXA', 'xr1'], ['ENRY', 'ENCN', 'LN-EXB', 'xr2']].map((x, i) => ({ id: 'xp' + i, title: x[0] + ' – ' + x[1], f: { depapt: x[0], destapt: x[1], reg: x[2] }, routeId: x[3] }));
    const routes = packs.map((p, i) => ({ id: 'xr' + i, title: p.title, packId: p.id, pts: [{ n: p.f.depapt, t: 'rwy' }, { n: p.f.destapt, t: 'rwy' }] }));
    return { items, packs, routes };
  }

  const API = { GROUPS, GROUP_OF, citesOf, tabsOf, buildGraph, layout, sampleInput, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH = API;
})(typeof window !== 'undefined' ? window : globalThis);
