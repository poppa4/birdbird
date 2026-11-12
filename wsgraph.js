/* Birdbird – My Workspace map, core logic (no DOM): runs in the browser (window.WSGRAPH) and in node tests.
   buildGraph   the workspace as nodes and links, only from relations already in the data:
                  document -> aircraft (acIds) · note -> aircraft / document / pack (links) · note -> cited page
                  (<cite data-doc data-p>) -> document · pack <-> route (routeId, xs.route, packId) · pack -> aircraft
                  (pack mark, else registration) · desk -> the items open in its tabs. Ink on a PDF marks its document.
                Every node is given the aircraft it gathers around (its cluster): direct links first, then the
                majority of its neighbours. Nodes with no aircraft float free.
   groupsOf     the groups of the map: one per aircraft, then 'Unsorted' (items with no aircraft); groupName names them.
   cloudLayout  the map as a soft cloud: each group a blob of evenly spread dots, the blobs side by side (arrange) so
                together they read as one cloud. Only your own items (or, when you have none, the small example).
   sampleInput  a small example workspace for the empty map (about twenty dots).
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
    const items = input.items || {}, name = opts.name || DEF_NAME, pages = opts.pages !== false, desks = opts.desks !== false;
    const pageName = opts.pageName || ((dl, p) => dl + ' · p. ' + p);
    const nodes = [], index = {}, links = [], lk = new Set();
    const add = (k, r, label, extra) => { const id = k + ':' + r; if (index[id] != null) return index[id]; index[id] = nodes.length; nodes.push(Object.assign({ id, k, g: GROUP_OF[k], r: String(r), label: str(label) || k, ac: '', deg: 0 }, extra || {})); return index[id]; };
    const link = (a, b, k) => { if (a == null || b == null || a === b) return; const key = a < b ? a + '-' + b : b + '-' + a; if (lk.has(key)) return; lk.add(key); links.push({ s: a, t: b, k }); nodes[a].deg++; nodes[b].deg++; };
    const at = (k, r) => index[k + ':' + r];
    const all = Object.values(items).filter(isLive);
    const of = k => all.filter(it => it.kind === k).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1));
    const aircraft = of('aircraft');
    aircraft.forEach(a => add('aircraft', a.id, a.mapLabel || name('aircraft', a), { type: str(a.type) }));
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
    if (desks) of('desk').forEach(d => {
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

  /* ---------- the cloud ---------- */
  function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const rnd = (s, salt) => (hash(s + '|' + salt) % 100000) / 100000;
  function prng(seed) { let s = (seed >>> 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0; s = Math.imul(s ^ (s >>> 13), 3266489917) >>> 0; s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
  const CLOUD_MAX = 600; /* the 3D map up to this many nodes; the 2D cloud takes any size */
  const RANK = { aircraft: 0, doc: 1, pack: 2, route: 3, note: 4, notebook: 4, desk: 5, page: 6 };
  /* short name of an aircraft type: 'Diamond DA42' -> 'DA42', 'Cessna 172' -> 'C172', 'King Air B200' -> 'B200' */
  function shortType(type) {
    const w = str(type).split(/\s+/).filter(Boolean), k = w.findIndex(x => /\d/.test(x));
    if (k < 0) return w.join(' ').slice(0, 14);
    return /^\d/.test(w[k]) && k > 0 ? w[k - 1][0].toUpperCase() + w[k] : w[k];
  }
  /* the groups: one per aircraft (in the order they were added), then 'Unsorted' for the items with no aircraft.
     -> [{ key, ac (node index or -1), m: [node indices: the aircraft, documents, packs, routes, notes], n: items besides the aircraft }] */
  function groupsOf(g) {
    const by = {}, out = [], free = { key: '', ac: -1, m: [] };
    g.nodes.forEach((n, i) => { if (n.k === 'aircraft') { by[n.id] = { key: n.id, ac: i, m: [] }; out.push(by[n.id]); } });
    g.nodes.forEach((n, i) => { (n.ac && by[n.ac] ? by[n.ac] : free).m.push(i); });
    if (free.m.length) out.push(free);
    out.forEach(G => { G.m.sort((a, b) => (RANK[g.nodes[a].k] - RANK[g.nodes[b].k]) || (g.nodes[b].deg - g.nodes[a].deg) || a - b); G.n = G.m.length - (G.ac >= 0 ? 1 : 0); });
    return out;
  }
  /* a group's name: the aircraft type (DA42), with the registration when two share a type; 'Unsorted' */
  function groupName(g, groups, G, t) {
    t = t || (en => en);
    if (G.ac < 0) return t('Unsorted', 'Uten fly');
    const n = g.nodes[G.ac], s = shortType(n.type); if (!s) return n.label;
    return groups.some(o => o !== G && o.ac >= 0 && shortType(g.nodes[o.ac].type) === s) ? s + ' ' + n.label : s;
  }
  /* groups of radius R[k] side by side in rows, the middle of each row raised a little (the top of a cumulus), rows
     staggered; the number per row is the one whose overall shape is nearest the aspect asked for (width / height).
     gap: between the dots of neighbouring groups; lab: extra room above each row for its names.
     -> { c: [[x, y]] (y down, centred), cols, w, h } */
  function arrange(R, aspect, gap, lab) {
    const K = R.length; if (!K) return { c: [], cols: 0, w: 0, h: 0 };
    let best = null;
    for (let cols = 1; cols <= K; cols++) {
      const rows = []; for (let i = 0; i < K; i += cols) rows.push(R.slice(i, i + cols).map((r, j) => i + j));
      const c = new Array(K); let y = 0, prev = 0;
      rows.forEach((row, ri) => {
        const mr = Math.max(...row.map(i => R[i])), L = row.length;
        if (ri) y += prev + mr + gap + lab; prev = mr;
        let x = 0; row.forEach((i, j) => { if (j) x += R[row[j - 1]] + R[i] + gap; const u = L > 1 ? (j - (L - 1) / 2) / ((L - 1) / 2) : 0; c[i] = [x, y - (L > 1 ? mr * 0.16 * (1 - u * u) : 0)]; });
        const sh = x / 2 - (ri % 2 && rows.length > 1 && L === cols ? -mr * 0.35 : 0); row.forEach(i => { c[i][0] -= sh; });
      });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      c.forEach(([x, yy], i) => { x0 = Math.min(x0, x - R[i]); x1 = Math.max(x1, x + R[i]); y0 = Math.min(y0, yy - R[i] - lab); y1 = Math.max(y1, yy + R[i]); });
      const score = Math.abs(Math.log((x1 - x0) / (y1 - y0) / (aspect || 1.6)));
      if (!best || score < best.score - 1e-9) best = { score, c, cols, x0, y0, x1, y1 };
    }
    const mx = (best.x0 + best.x1) / 2, my = (best.y0 + best.y1) / 2;
    return { c: best.c.map(([x, y]) => [x - mx, y - my]), cols: best.cols, w: best.x1 - best.x0, h: best.y1 - best.y0 };
  }
  const D = 26; /* world distance between neighbouring dots */
  /* the map as a cloud: each group a soft blob of evenly spread dots (a sunflower spiral: the aircraft in the middle, its
     documents nearest, then packs, routes, notes), the blobs side by side so together they read as one cloud.
     opts { aspect (width / height of the plate), instant }
     -> { n, x, y, tx, ty, gi (group per node), groups: [{ key, ac, n, m, cx, cy, r (dots), puffs: [{ x, y, r }] }], frame,
          cols, cloud: true, settled, step(k), run(), bounds(), positions() }. A short intro, then it is still. */
  function cloudLayout(g, opts) {
    opts = opts || {};
    const N = g.nodes.length, x = new Float64Array(N), y = new Float64Array(N), tx = new Float64Array(N), ty = new Float64Array(N), x0 = new Float64Array(N), y0 = new Float64Array(N), gi = new Int32Array(N).fill(-1);
    const G = groupsOf(g), c = D / 1.55, GA = Math.PI * (3 - Math.sqrt(5));
    const rad = G.map(q => Math.max(D * 0.55, c * Math.sqrt(Math.max(0, q.m.length - 1) + 0.6)));
    const A = arrange(rad, opts.aspect || 1.6, D * 1.5, D * 1.4);
    let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
    const groups = G.map((q, k) => {
      const [cx, cy] = A.c[k], R = rad[k], rot = rnd(q.key || 'unsorted', 'rot') * Math.PI * 2;
      q.m.forEach((i, j) => { const r = j ? c * Math.sqrt(j + 0.6) : 0, a = rot + j * GA; tx[i] = cx + Math.cos(a) * r; ty[i] = cy + Math.sin(a) * r; gi[i] = k;
        x0[i] = cx + (tx[i] - cx) * 0.3; y0[i] = cy + (ty[i] - cy) * 0.3; });
      /* the blob: a soft core and a few puffs round it, a little different for every group */
      const P = prng(hash('puff|' + (q.key || '~'))), puffs = [{ x: cx, y: cy, r: R + D * 1.7 }], np = 6 + Math.min(3, Math.floor(q.m.length / 8));
      for (let p = 0; p < np; p++) { const a = (p / np + P() * 0.1) * Math.PI * 2 + rot, d = R * (0.55 + P() * 0.3) + D * 0.6; puffs.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.78, r: R * (0.5 + P() * 0.25) + D * 1.25 }); }
      puffs.forEach(p => { fx0 = Math.min(fx0, p.x - p.r * 0.7); fx1 = Math.max(fx1, p.x + p.r * 0.7); fy1 = Math.max(fy1, p.y + p.r * 0.7); fy0 = Math.min(fy0, p.y - p.r * 0.7); });
      fy0 = Math.min(fy0, cy - R - D * 1.5);
      return { key: q.key, ac: q.ac, n: q.n, m: q.m, cx, cy, r: R, puffs };
    });
    const frame = N ? { x0: fx0, y0: fy0, x1: fx1, y1: fy1 } : { x0: -40, y0: -40, x1: 40, y1: 40 };
    const INTRO = 40;
    const st = { n: N, x, y, tx, ty, gi, groups, frame, cols: A.cols, aspect: opts.aspect || 1.6, D, cloud: true, settled: false, steps: 0 };
    const at = p => { if (p >= 1) { x.set(tx); y.set(ty); return; } const e = 1 - Math.pow(1 - p, 3); for (let i = 0; i < N; i++) { x[i] = x0[i] + (tx[i] - x0[i]) * e; y[i] = y0[i] + (ty[i] - y0[i]) * e; } };
    st.step = k => { if (st.settled) return false; st.steps += k || 1; const p = Math.min(1, st.steps / INTRO); at(p); if (p >= 1) st.settled = true; return !st.settled; };
    st.run = () => { at(1); st.settled = true; return 0; };
    at(0); if (opts.instant || N === 0) st.run();
    st.bounds = idx => { let a = Infinity, b = Infinity, cc = -Infinity, d = -Infinity; (idx || g.nodes.map((n, i) => i)).forEach(i => { if (x[i] < a) a = x[i]; if (x[i] > cc) cc = x[i]; if (y[i] < b) b = y[i]; if (y[i] > d) d = y[i]; }); return a === Infinity ? { x0: -1, y0: -1, x1: 1, y1: 1 } : { x0: a, y0: b, x1: cc, y1: d }; };
    st.positions = () => { const o = {}; g.nodes.forEach((n, i) => { o[n.id] = [x[i], y[i]]; }); return o; };
    return st;
  }

  /* ---------- an example workspace for the empty map: three aircraft, each with an AFM, a checklist, a few notes that
     refer to them, a briefing pack and its route (about twenty dots, every one meaningful) ---------- */
  function sampleInput(t) {
    t = t || ((en) => en);
    const items = {}, now = 1700000000000; let seq = 0;
    const put = o => { o.createdAt = now + seq++; o.updatedAt = o.createdAt; items[o.id] = o; return o; };
    const ac = [put({ id: 'xa1', kind: 'aircraft', type: 'Diamond DA42', reg: 'LN-EXA' }),
      put({ id: 'xa2', kind: 'aircraft', type: 'King Air B200', reg: 'LN-EXB' }),
      put({ id: 'xa3', kind: 'aircraft', type: 'Cessna 172', reg: 'LN-EXC' })];
    const short = a => shortType(a.type);
    const docs = ac.map((a, k) => [put({ id: 'xd' + k + 'a', kind: 'doc', name: (k === 2 ? 'POH ' : 'AFM ') + short(a), cat: 'afm', acIds: [a.id] }),
      put({ id: 'xd' + k + 'c', kind: 'doc', name: t('Checklist ', 'Sjekkliste ') + short(a), cat: 'chk', acIds: [a.id] })]);
    const cite = (d, p) => `<div><cite data-doc="${d.id}" data-p="${p}">${d.name} p. ${p}</cite></div>`;
    [[0, t('Engine failure after take-off', 'Motorsvikt etter avgang'), 0, 12], [0, 'VMCA', 0, 27], [0, t('Fuel planning', 'Drivstoffplanlegging'), -1, 0],
      [1, t('Pressurisation', 'Trykkabin'), 0, 44], [1, t('Engine fire', 'Motorbrann'), 1, 3],
      [2, t('Stall recovery', 'Steiling'), 0, 18], [2, t('Crosswind landing', 'Sidevindslanding'), 1, 2]].forEach(([a, title, d, p], i) =>
      put({ id: 'xn' + i, kind: 'note', title, body: d >= 0 ? cite(docs[a][d], p) : '<div></div>', links: d < 0 ? [{ t: 'aircraft', id: ac[a].id }] : [] }));
    const packs = [['ENTO', 'ENBR'], ['ENGM', 'ENVA'], ['ENRY', 'ENCN']].map((x, i) => ({ id: 'xp' + i, title: x[0] + ' – ' + x[1], f: { depapt: x[0], destapt: x[1], reg: ac[i].reg }, routeId: 'xr' + i }));
    const routes = packs.map((p, i) => ({ id: 'xr' + i, title: p.title, packId: p.id, pts: [{ n: p.f.depapt, t: 'rwy' }, { n: p.f.destapt, t: 'rwy' }] }));
    return { items, packs, routes };
  }

  const API = { GROUPS, GROUP_OF, citesOf, tabsOf, buildGraph, groupsOf, groupName, arrange, cloudLayout, CLOUD_MAX, D, shortType, sampleInput, hash, prng };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSGRAPH = API;
})(typeof window !== 'undefined' ? window : globalThis);
