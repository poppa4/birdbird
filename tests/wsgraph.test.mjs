/* My Workspace map: graph from the workspace, groups by aircraft, the cloud layout.  node --test tests/wsgraph.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../wsgraph.js');
const W = req('../workspacecore.js');
const D = req('../deskcore.js');

function workspace() {
  const a1 = W.newAircraft({ id: 'a1', typeKey: 'da42', reg: 'LN-ABC' }, 1), a2 = W.newAircraft({ id: 'a2', typeKey: 'c172', reg: 'LN-XYZ' }, 2);
  const d1 = W.newDocEntry({ id: 'd1', name: 'AFM DA42', acIds: ['a1'] }, 3), d2 = W.newDocEntry({ id: 'd2', name: 'POH C172', acIds: ['a2'] }, 4), d3 = W.newDocEntry({ id: 'd3', name: 'EASA Part-FCL' }, 5);
  const n1 = W.newNote({ id: 'n1', title: 'VMCA', body: '<div><cite data-doc="d1" data-p="12">AFM p. 12</cite> and <cite data-doc="d1" data-p="12">again</cite></div>' }, 6);
  const n2 = W.newNote({ id: 'n2', title: 'Engine failure', body: '<cite data-doc="d1" data-p="40">x</cite>', links: [{ t: 'aircraft', id: 'a1' }] }, 7);
  const n3 = W.newNote({ id: 'n3', title: 'Loose note', body: 'nothing' }, 8);
  const n4 = W.newNote({ id: 'n4', title: 'Deleted', body: '<cite data-doc="d2" data-p="3">x</cite>' }, 9); n4.deletedAt = 10;
  const ink = { id: 'ink:d2', kind: 'ink', doc: 'd2', pages: { 3: ['p|x'], 4: [] }, createdAt: 1, updatedAt: 1 };
  let L = D.newLayout(); L = D.open(L, 'doc', 'd1').L; L = D.open(L, 'note', 'n3').L; L = D.open(L, 'route', 'r1').L;
  const desk = D.newDesk({ id: 'k1', name: 'Next flight', L }, 11);
  const items = {}; [a1, a2, d1, d2, d3, n1, n2, n3, n4, ink, desk].forEach(x => { items[x.id] = x; });
  items['pk:p2'] = W.newPackMark('p2', { acId: 'a2' }, 12);
  const packs = [{ id: 'p1', f: { reg: 'LN-ABC', depapt: 'ENTO' }, routeId: 'r1' }, { id: 'p2', f: { depapt: 'ENRY' }, xs: { route: 'r2' } }];
  const routes = [{ id: 'r1', pts: [{ n: 'ENTO' }] }, { id: 'r2', pts: [{ n: 'ENRY' }], packId: 'p2' }, { id: 'r3', pts: [{ n: 'ENGM' }] }];
  return { items, packs, routes };
}
const has = (g, a, b) => g.links.some(l => { const s = g.nodes[l.s].id, t = g.nodes[l.t].id; return (s === a && t === b) || (s === b && t === a); });

test('cites: each page once, attributes in any order, plain cites ignored', () => {
  assert.deepEqual(M.citesOf('<cite data-doc="d1" data-p="4">a</cite><cite data-p="4" data-doc="d1">b</cite><cite>c</cite><cite data-doc="d2" data-p="9">'), [{ doc: 'd1', p: 4 }, { doc: 'd2', p: 9 }]);
  assert.deepEqual(M.citesOf(''), []);
});

test('nodes: live items only, packs and routes, a desk with open items, cited pages', () => {
  const g = M.buildGraph(workspace());
  const ids = g.nodes.map(n => n.id);
  for (const id of ['aircraft:a1', 'aircraft:a2', 'doc:d1', 'doc:d2', 'doc:d3', 'note:n1', 'note:n2', 'note:n3', 'pack:p1', 'pack:p2', 'route:r1', 'route:r2', 'route:r3', 'desk:k1', 'page:d1#12', 'page:d1#40']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('note:n4'), 'trashed note is left out');
  assert.ok(!ids.includes('page:d2#3'), 'a page cited only by a trashed note is left out');
  assert.equal(new Set(ids).size, ids.length, 'every node once');
  assert.deepEqual({ ...g.counts }, { aircraft: 2, doc: 3, note: 3, pack: 2, route: 3, desk: 1, page: 2 });
  assert.equal(g.own, 13, 'own items exclude pages and desks');
  assert.equal(g.nodes[g.index['doc:d2']].ink, 1, 'ink on one page marks the document');
});

test('links: only relations already in the data', () => {
  const g = M.buildGraph(workspace());
  assert.ok(has(g, 'doc:d1', 'aircraft:a1')); assert.ok(has(g, 'doc:d2', 'aircraft:a2'));
  assert.ok(has(g, 'note:n1', 'page:d1#12')); assert.ok(has(g, 'page:d1#12', 'doc:d1'));
  assert.ok(has(g, 'note:n2', 'aircraft:a1'));
  assert.ok(has(g, 'pack:p1', 'route:r1'), 'pack.routeId'); assert.ok(has(g, 'pack:p2', 'route:r2'), 'xs.route / packId');
  assert.ok(has(g, 'pack:p1', 'aircraft:a1'), 'registration'); assert.ok(has(g, 'pack:p2', 'aircraft:a2'), 'pack mark');
  assert.ok(has(g, 'desk:k1', 'doc:d1') && has(g, 'desk:k1', 'note:n3') && has(g, 'desk:k1', 'route:r1'));
  assert.ok(!g.nodes.some((n, i) => g.links.filter(l => l.s === i || l.t === i).length !== n.deg), 'degree matches');
  const keys = g.links.map(l => Math.min(l.s, l.t) + '-' + Math.max(l.s, l.t)); assert.equal(new Set(keys).size, keys.length, 'no double links');
  const g2 = M.buildGraph(workspace(), { pages: false });
  assert.ok(has(g2, 'note:n1', 'doc:d1')); assert.ok(!g2.nodes.some(n => n.k === 'page'));
  const g3 = M.buildGraph(workspace(), { packAc: p => p.id === 'p1' ? 'a2' : '' });
  assert.ok(has(g3, 'pack:p1', 'aircraft:a2') && !has(g3, 'pack:p2', 'aircraft:a2'), 'the page can decide the pack aircraft');
});

test('clusters: each node gathers around an aircraft through its links; desks lend none', () => {
  const g = M.buildGraph(workspace()), ac = id => g.nodes[g.index[id]].ac;
  assert.equal(ac('aircraft:a1'), 'aircraft:a1');
  assert.equal(ac('doc:d1'), 'aircraft:a1'); assert.equal(ac('page:d1#12'), 'aircraft:a1'); assert.equal(ac('note:n1'), 'aircraft:a1');
  assert.equal(ac('route:r1'), 'aircraft:a1', 'route through its pack'); assert.equal(ac('route:r2'), 'aircraft:a2');
  assert.equal(ac('note:n3'), '', 'only on a desk: free'); assert.equal(ac('doc:d3'), ''); assert.equal(ac('route:r3'), '');
});

test('empty workspace: an empty graph that is settled at once; the example is small and meaningful', () => {
  const g = M.buildGraph({}); assert.equal(g.nodes.length, 0); const L0 = M.cloudLayout(g); assert.ok(L0.settled && L0.groups.length === 0);
  const s = M.buildGraph(M.sampleInput(), { pages: false, desks: false });
  assert.ok(s.nodes.length >= 40 && s.nodes.length <= 55, s.nodes.length + ' nodes');
  assert.deepEqual({ ...s.counts }, { aircraft: 3, doc: 13, note: 21, pack: 6, route: 6, desk: 0, page: 0 });
  /* every aircraft: an AFM (or POH), a checklist, 2-3 notes, a pack and a route, all in its own cluster */
  for (const a of s.nodes.filter(n => n.k === 'aircraft')) {
    const m = s.nodes.filter(n => n.ac === a.id), of = k => m.filter(n => n.k === k).length;
    assert.ok(of('doc') === 4 && of('note') >= 5 && of('note') <= 6 && of('pack') === 2 && of('route') === 2, a.id);
    assert.ok(m.some(n => /^(AFM|POH) /.test(n.label)) && m.some(n => /^Checklist /.test(n.label)), a.id);
  }
  assert.equal(s.nodes.filter(n => !n.ac).length, 5, 'one small general group');
  assert.ok(s.nodes.every(n => n.deg >= 1), 'every dot has a real link');
  assert.equal(M.buildGraph(M.sampleInput((en, no) => no)).nodes.find(n => n.k === 'doc' && n.label.startsWith('Sjekkliste')) != null, true, 'Norwegian');
});

test('buildGraph: desks and pages can be left out; aircraft carry their type', () => {
  const g = M.buildGraph(workspace(), { pages: false, desks: false });
  assert.ok(!g.nodes.some(n => n.k === 'desk' || n.k === 'page'));
  assert.equal(g.own, 13); assert.equal(g.counts.desk, 0);
  assert.equal(g.nodes[g.index['aircraft:a1']].type, 'Diamond DA42');
  assert.equal(M.shortType('Diamond DA42'), 'DA42'); assert.equal(M.shortType('Cessna 172'), 'C172'); assert.equal(M.shortType('King Air B200'), 'B200'); assert.equal(M.shortType(''), '');
});

const SAMPLE = () => M.buildGraph(M.sampleInput(), { pages: false, desks: false });
const minDist = L => { let m = Infinity; for (let i = 0; i < L.n; i++) for (let j = i + 1; j < L.n; j++) m = Math.min(m, Math.hypot(L.x[i] - L.x[j], L.y[i] - L.y[j])); return m; };
/* every dot inside its own group's disc, nearer its own group's middle than any other; discs of different groups apart */
function checkGroups(g, L, tag) {
  g.nodes.forEach((n, i) => {
    const k = L.gi[i], q = L.groups[k]; assert.ok(k >= 0, tag + ' ' + n.id + ' in a group');
    assert.ok(Math.hypot(L.x[i] - q.cx, L.y[i] - q.cy) <= q.r + 1e-6, tag + ' inside its blob: ' + n.id);
    assert.equal(q.ac >= 0 ? g.nodes[q.ac].id : '', n.ac && g.index[n.ac] != null ? n.ac : '', tag + ' grouped by its aircraft: ' + n.id);
  });
  for (let a = 0; a < L.groups.length; a++) for (let b = a + 1; b < L.groups.length; b++) {
    const p = L.groups[a], q = L.groups[b]; assert.ok(Math.hypot(p.cx - q.cx, p.cy - q.cy) >= p.r + q.r + L.D, tag + ' groups apart');
  }
}

test('cloud: the example is three blobs, the same every time, each aircraft its own named group', () => {
  const g = SAMPLE(), a = M.cloudLayout(g), b = M.cloudLayout(SAMPLE());
  assert.ok(!a.settled, 'a short intro first'); let n = 0; while (a.step(2)) n++; assert.ok(a.settled && n < 40, 'intro ends after ' + n + ' frames');
  b.run(); assert.deepEqual([...a.x], [...b.x]); assert.deepEqual([...a.y], [...b.y]);
  assert.ok(g.nodes.every((nd, i) => a.x[i] === a.tx[i] && a.y[i] === a.ty[i]), 'ends exactly on its place');
  assert.equal(a.groups.length, 4);
  assert.deepEqual(a.groups.slice(0, 3).map(q => M.groupName(g, a.groups, q)), ['DA42', 'B200', 'C172']);
  assert.deepEqual(a.groups.map(q => q.n), [14, 14, 13, 5], 'counts: the items besides the aircraft');
  assert.ok(a.groups.slice(0, 3).every(q => g.nodes[q.m[0]].k === 'aircraft' && Math.hypot(a.x[q.m[0]] - q.cx, a.y[q.m[0]] - q.cy) < 1e-9), 'the aircraft in the middle');
  checkGroups(g, a, 'example');
  assert.ok(minDist(a) >= 0.75 * a.D, 'evenly spread, no clumps: ' + minDist(a).toFixed(1));
  assert.ok(a.groups.every(q => q.puffs.length >= 6 && q.puffs.every(p => p.r > q.r * 0.5)), 'soft blobs');
  const f = a.frame; assert.ok(f.x1 - f.x0 > f.y1 - f.y0, 'on a wide plate: wider than tall');
  const c = M.cloudLayout(g, { instant: true }); assert.ok(c.settled); assert.deepEqual([...c.x], [...a.x]);
  assert.equal(a.step(1), false);
});

test('cloud: the shape follows the plate (a row on a wide one, rows on a tall one)', () => {
  const g = SAMPLE(), wide = M.cloudLayout(g, { aspect: 1.6, instant: true }), tall = M.cloudLayout(g, { aspect: 0.6, instant: true });
  assert.equal(wide.cols, 3); assert.ok(tall.cols < 3);
  const ar = L => (L.frame.x1 - L.frame.x0) / (L.frame.y1 - L.frame.y0); assert.ok(ar(tall) < ar(wide));
  checkGroups(g, tall, 'tall');
  const A = M.arrange([10, 10, 10, 10, 10, 10], 1, 4, 4); assert.ok(A.cols > 1 && A.cols < 6);
  assert.deepEqual(M.arrange([], 1, 1, 1).c, []);
});

test('groupName: the type, the registration when two share it; Unsorted', () => {
  const items = {}; [W.newAircraft({ id: 'a1', typeKey: 'da42', reg: 'LN-ABC' }, 1), W.newAircraft({ id: 'a2', typeKey: 'da42', reg: 'LN-DEF' }, 2), W.newNote({ id: 'n1', title: 'x' }, 3)].forEach(x => { items[x.id] = x; });
  const g = M.buildGraph({ items }), G = M.groupsOf(g);
  assert.deepEqual(G.map(q => M.groupName(g, G, q)), ['DA42 LN-ABC', 'DA42 LN-DEF', 'Unsorted']);
  assert.equal(M.groupName(g, G, G[2], (en, no) => no), 'Uten fly');
});

/* own workspace of n items: an aircraft or two, documents filed under them, notes citing pages, a loose note */
function ownOf(n, noAc) {
  const items = {}, put = x => { items[x.id] = x; };
  const L = [];
  if (n >= 1 && !noAc) L.push(W.newAircraft({ id: 'a1', typeKey: 'da42', reg: 'LN-ABC' }, 1));
  if (n >= 6 && !noAc) L.push(W.newAircraft({ id: 'a2', typeKey: 'c172', reg: 'LN-XYZ' }, 2));
  for (let i = 0; L.length < n; i++) {
    if (i % 3 === 0) L.push(W.newDocEntry({ id: 'd' + i, name: 'Doc ' + i, acIds: noAc || i % 2 ? [] : [i % 4 && n >= 6 ? 'a2' : 'a1'] }, 10 + i));
    else { const d = 'd' + (i - i % 3); L.push(W.newNote({ id: 'n' + i, title: 'Note ' + i, body: i % 2 ? `<cite data-doc="${d}" data-p="${i}">x</cite>` : 'loose' }, 10 + i)); }
  }
  L.forEach(put); return { items };
}
const OWN = (n, noAc) => M.buildGraph(ownOf(n, noAc), { pages: false, desks: false });

test('own map: only your own items, a group per aircraft plus Unsorted; deterministic; evenly spread', () => {
  for (const n of [1, 3, 12, 25, 45, 120]) {
    const g = OWN(n), L = M.cloudLayout(g, { instant: true });
    assert.equal(g.nodes.length, n, 'only your own nodes (' + n + ')');
    assert.ok(g.nodes.every(nd => !nd.ghost && !nd.id.startsWith('ex:')), 'no example nodes');
    const acs = g.counts.aircraft, free = g.nodes.some(nd => !nd.ac);
    assert.equal(L.groups.length, acs + (free ? 1 : 0), 'a group per aircraft, plus Unsorted (' + n + ')');
    assert.equal(L.groups.reduce((s, q) => s + q.m.length, 0), n, 'every item in one group');
    checkGroups(g, L, 'own ' + n);
    if (n > 1) assert.ok(minDist(L) >= 0.75 * L.D, 'no dots on top of each other (' + n + ')');
  }
  const a = M.cloudLayout(OWN(30), { instant: true }), b = M.cloudLayout(OWN(30), { instant: true }); assert.deepEqual([...a.x], [...b.x]);
});

test('own map: no aircraft is one Unsorted group; loose items go to Unsorted', () => {
  const gn = OWN(8, true), Ln = M.cloudLayout(gn, { instant: true });
  assert.equal(gn.counts.aircraft, 0); assert.equal(Ln.groups.length, 1); assert.equal(Ln.groups[0].ac, -1); assert.equal(Ln.groups[0].n, 8);
  const g12 = OWN(12), L12 = M.cloudLayout(g12, { instant: true }), u = L12.groups[L12.groups.length - 1];
  assert.equal(u.ac, -1); assert.ok(u.m.every(i => !g12.nodes[i].ac));
});

test('large workspaces: 2000 items laid out quickly, still apart', () => {
  const items = {}; for (let i = 0; i < 4; i++) items['a' + i] = W.newAircraft({ id: 'a' + i, typeKey: 'da42', reg: 'LN-' + i }, i + 1);
  for (let i = 0; i < 1996; i++) { const n = W.newNote({ id: 'n' + i, title: 'n' + i, links: i % 5 ? [{ t: 'aircraft', id: 'a' + (i % 4) }] : [] }, 100 + i); items[n.id] = n; }
  const g = M.buildGraph({ items }), t0 = Date.now(), L = M.cloudLayout(g, { instant: true });
  assert.ok(Date.now() - t0 < 1500, 'took ' + (Date.now() - t0) + ' ms');
  assert.equal(L.groups.length, 5); checkGroups(g, L, 'large');
  assert.ok(minDist(L) >= 0.7 * L.D);
});
