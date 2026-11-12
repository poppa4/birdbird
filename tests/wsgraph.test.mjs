/* My Workspace map: graph from the workspace, clusters, force layout.  node --test tests/wsgraph.test.mjs */
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

test('empty workspace: an empty graph that is settled at once; the example has a little of everything', () => {
  const g = M.buildGraph({}); assert.equal(g.nodes.length, 0); assert.ok(M.layout(g).settled);
  const s = M.buildGraph(M.sampleInput());
  assert.ok(s.counts.aircraft === 3 && s.counts.doc >= 6 && s.counts.note >= 12 && s.counts.pack >= 3 && s.counts.route >= 3);
  assert.ok(s.nodes.every(n => n.k === 'aircraft' || n.ac || n.g === 'doc' || n.k === 'note'));
});

test('layout: deterministic, settles, keeps nodes apart, clusters stay apart', () => {
  const g = M.buildGraph(M.sampleInput());
  const a = M.layout(g), b = M.layout(g);
  const n = a.run(2000); b.run(2000);
  assert.ok(a.settled && n < 1000, 'settles in ' + n + ' steps');
  assert.deepEqual([...a.x], [...b.x], 'same graph, same picture');
  assert.ok([...a.x, ...a.y].every(Number.isFinite));
  let close = 0; for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) if (Math.hypot(a.x[i] - a.x[j], a.y[i] - a.y[j]) < 1.5) close++;
  assert.ok(close <= 2, close + ' pairs on top of each other');
  const i1 = g.index['aircraft:xa1'], i2 = g.index['aircraft:xa2'];
  assert.ok(Math.hypot(a.x[i1] - a.x[i2], a.y[i1] - a.y[i2]) > 120, 'aircraft apart');
  /* members are nearer their own aircraft than the other one */
  const mem = g.nodes.map((nd, i) => [nd, i]).filter(([nd]) => nd.ac === 'aircraft:xa1' && nd.k !== 'aircraft');
  const nearer = mem.filter(([, i]) => Math.hypot(a.x[i] - a.x[i1], a.y[i] - a.y[i1]) < Math.hypot(a.x[i] - a.x[i2], a.y[i] - a.y[i2])).length;
  assert.ok(nearer / mem.length > 0.85, nearer + ' of ' + mem.length);
  assert.equal(a.step(1), false, 'a settled layout does no more work');
  a.reheat(0.2); assert.ok(!a.settled); a.run(); assert.ok(a.settled);
});

test('layout: previous positions are kept when the graph changes', () => {
  const g = M.buildGraph(M.sampleInput()), a = M.layout(g); a.run();
  const pos = a.positions(), b = M.layout(g, { prev: pos }), i = 5;
  assert.equal(b.x[i], a.x[i]); assert.ok(b.alpha < 1);
});

test('layout: 2000 nodes run with the spatial hash in reasonable time', () => {
  const items = {}; for (let i = 0; i < 20; i++) items['a' + i] = W.newAircraft({ id: 'a' + i, reg: 'LN-' + i }, i + 1);
  for (let i = 0; i < 1980; i++) { const n = W.newNote({ id: 'n' + i, title: 'n' + i, links: [{ t: 'aircraft', id: 'a' + (i % 20) }] }, 100 + i); items[n.id] = n; }
  const g = M.buildGraph({ items }); assert.equal(g.nodes.length, 2000);
  const L = M.layout(g), t0 = Date.now(); for (let k = 0; k < 30; k++) L.step(1);
  assert.ok(Date.now() - t0 < 3000, 'thirty steps took ' + (Date.now() - t0) + ' ms');
});

test('brain: the example sits inside the silhouette, the same every time, each aircraft in its own region', () => {
  const g = M.buildGraph(M.sampleInput()), a = M.brainLayout(g), b = M.brainLayout(M.buildGraph(M.sampleInput()));
  assert.ok(!a.settled, 'a short intro first'); let n = 0; while (a.step(2)) n++; assert.ok(a.settled && n < 60, 'intro ends after ' + n + ' frames');
  b.run(); assert.deepEqual([...a.x], [...b.x]); assert.deepEqual([...a.y], [...b.y]);
  assert.ok(g.nodes.every((nd, i) => M.inBrain(a.x[i] / a.S, a.y[i] / a.S, 0.01)), 'every node inside the brain');
  assert.ok(g.nodes.every((nd, i) => a.x[i] === a.tx[i] && a.y[i] === a.ty[i]), 'ends exactly on its place');
  let close = 0; for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) if (Math.hypot(a.x[i] - a.x[j], a.y[i] - a.y[j]) < 6) close++;
  assert.equal(close, 0, 'no dots on top of each other');
  const acs = g.nodes.map((nd, i) => [nd, i]).filter(([nd]) => nd.k === 'aircraft');
  assert.equal(acs.length, 3); assert.ok(acs.map(([nd]) => nd.label).join(' | ').includes('DA42 — ME/IR'));
  /* members are nearer their own aircraft than any other */
  let ok = 0, all = 0;
  g.nodes.forEach((nd, i) => { if (nd.k === 'aircraft' || !nd.ac) return; all++; const d = ([, j]) => Math.hypot(a.x[i] - a.x[j], a.y[i] - a.y[j]); const own = acs.find(([x]) => x.id === nd.ac); if (acs.every(c => c === own || d(own) <= d(c))) ok++; });
  assert.ok(ok / all > 0.8, ok + ' of ' + all);
  const f = a.frame; assert.ok(f.x1 - f.x0 > f.y1 - f.y0, 'wider than tall');
  const c = M.brainLayout(g, { instant: true }); assert.ok(c.settled); assert.deepEqual([...c.x], [...a.x]);
  assert.equal(a.step(1), false);
});

test('brain: outline and texture', () => {
  assert.ok(M.inBrain(-0.3, -0.3) && M.inBrain(0.58, 0.4), 'cerebrum and cerebellum'); assert.ok(!M.inBrain(0, 0.9) && !M.inBrain(-1.2, 0) && !M.inBrain(0, -0.95));
  const T = M.brainTexture(200), T2 = M.brainTexture(200);
  assert.equal(T, T2, 'cached'); assert.equal(T.pts.length, 200); assert.ok(T.pts.every(([x, y]) => M.inBrain(x, y)));
  assert.ok(T.links.length > 150 && T.links.every(([i, j]) => i !== j && T.pts[i] && T.pts[j]));
  const e = M.brainLayout(M.buildGraph({})); assert.ok(e.settled && e.n === 0);
});
