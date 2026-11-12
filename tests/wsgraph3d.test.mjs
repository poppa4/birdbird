/* My Workspace map in 3D: a brain made of points.  node --test tests/wsgraph3d.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../wsgraph.js');
const B = req('../wsgraph3d.js');
const S = B.S;
const SAMPLE = () => M.buildGraph(M.sampleInput(), { pages: false, desks: false });
const at = (L, i) => [L.P[i * 3] / S, L.P[i * 3 + 1] / S, L.P[i * 3 + 2] / S];
const inside = (L, i, m) => B.sdf(...at(L, i)) < -(m || 0);
/* n own items: aircraft (1, 2 from 6 items, 3 from 30), documents (every fourth without an aircraft), notes citing them */
function OWN(n) {
  const items = {}, na = n >= 30 ? 3 : n >= 6 ? 2 : 1, ac = []; let c = 0, d = null, k = 0;
  const put = o => { o.createdAt = c++; items[o.id] = o; return o; };
  for (let i = 0; i < Math.min(na, n); i++) ac.push(put({ id: 'a' + i, kind: 'aircraft', type: ['Diamond DA42', 'Cessna 172', 'King Air B200'][i], reg: 'LN-' + i }));
  while (Object.keys(items).length < n) {
    if (k % 3 === 0) { const a = (k / 3) % 4 === 3 ? null : ac[(k / 3) % ac.length]; d = put({ id: 'd' + k, kind: 'doc', name: 'Doc ' + k, acIds: a ? [a.id] : [] }); }
    else put({ id: 'n' + k, kind: 'note', title: 'Note ' + k, body: k % 2 ? `<cite data-doc="${d.id}" data-p="${k}">p</cite>` : '', links: k % 4 === 1 ? [{ t: 'aircraft', id: ac[k % ac.length].id }] : [] });
    k++;
  }
  return M.buildGraph({ items }, { pages: false, desks: false });
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('the shape: a brain (cerebrum both sides, a fissure on top, cerebellum, stem), nothing outside', () => {
  assert.ok(B.sdf(0.3, 0.1, 0) < 0 && B.sdf(-0.3, 0.1, 0) < 0, 'both hemispheres');
  assert.ok(B.sdf(0, 0.5, 0) > 0, 'the longitudinal fissure opens the top');
  assert.ok(B.cerebellum(0.1, -0.38, -0.5) < 0 && B.stem(0, -0.7, -0.27) < 0, 'cerebellum and stem');
  assert.ok(B.sdf(0, 1, 0) > 0 && B.sdf(1, 0, 0) > 0 && B.sdf(0, 0, 1.1) > 0);
});

test('example: every point inside the brain, one lobe per aircraft, deterministic', () => {
  const g = SAMPLE(), a = B.layout3d(g), b = B.layout3d(SAMPLE());
  assert.ok(g.nodes.length >= 20 && g.nodes.length <= 25);
  assert.ok(g.nodes.every((n, i) => inside(a, i, 0.03)), 'inside, clear of the surface');
  assert.deepEqual([...a.P], [...b.P], 'the same workspace, the same brain');
  assert.deepEqual(a.clusters.map(c => c.lobe), ['frontal', 'parietal', 'temporal']);
  assert.deepEqual(a.clusters.map(c => g.nodes[c.ac].label), ['LN-EXA', 'LN-EXB', 'LN-EXC']);
  /* every item is nearer its own aircraft than any other aircraft */
  g.nodes.forEach((n, i) => { if (n.k === 'aircraft') return; const own = g.index[n.ac], d = dist(at(a, i), at(a, own));
    a.clusters.forEach(c => { if (c.ac !== own) assert.ok(d < dist(at(a, i), at(a, c.ac)), n.id); }); });
  assert.ok(a.grow.every(v => v >= 0 && v <= 1), 'growth 0..1');
});

test('points keep apart; a large map is laid out quickly', () => {
  for (const n of [3, 12, 40, 300]) {
    const g = OWN(n), L = B.layout3d(g);
    assert.ok(g.nodes.every((x, i) => inside(L, i, 0.02)), 'inside (' + n + ')');
    let md = Infinity; for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) md = Math.min(md, dist(at(L, i), at(L, j)));
    assert.ok(md > 0.03, 'apart (' + n + '): ' + md);
  }
  const t0 = performance.now(); B.layout3d(OWN(600)); assert.ok(performance.now() - t0 < 1500);
});

test('regions: aircraft lobes in order, Unsorted in the cerebellum, no aircraft fills the cerebrum', () => {
  const L = B.layout3d(OWN(12)), g = OWN(12);
  assert.deepEqual(L.clusters.map(c => c.lobe), ['frontal', 'parietal', 'cerebellum']);
  const u = L.clusters[2]; assert.equal(u.ac, -1); assert.ok(u.cb);
  g.nodes.forEach((n, i) => { if (!n.ac) assert.ok(B.cerebellum(...at(L, i)) < 0, 'loose item in the cerebellum: ' + n.id); });
  const items = {}; for (let i = 0; i < 5; i++) items['n' + i] = { id: 'n' + i, kind: 'note', title: 'x' + i, createdAt: i };
  const g2 = M.buildGraph({ items }, { pages: false, desks: false }), L2 = B.layout3d(g2);
  assert.equal(L2.clusters.length, 1); assert.equal(L2.clusters[0].lobe, 'cerebrum');
  /* five aircraft: lobes per hemisphere; ten: more regions, all distinct */
  const many = k => { const it = {}; for (let i = 0; i < k; i++) { it['a' + i] = { id: 'a' + i, kind: 'aircraft', type: 'Type ' + i, reg: 'R' + i, createdAt: i }; it['d' + i] = { id: 'd' + i, kind: 'doc', name: 'D' + i, acIds: ['a' + i], createdAt: 100 + i }; } return M.buildGraph({ items: it }, { pages: false, desks: false }); };
  assert.ok(B.layout3d(many(5)).clusters.every(c => /-[rl]$/.test(c.lobe)));
  const L10 = B.layout3d(many(10)); assert.equal(new Set(L10.clusters.map(c => c.lobe)).size, 10);
  assert.ok(many(10).nodes.every((n, i) => inside(L10, i, 0.02)));
});

test('background neurons: inside the shape, deterministic; a rich field for the example, a faint shell for your own', () => {
  const a = B.dust(800, { seed: 'x' }), b = B.dust(800, { seed: 'x' });
  assert.equal(a.P.length, 800 * 3); assert.deepEqual([...a.P.slice(0, 30)], [...b.P.slice(0, 30)]);
  for (let i = 0; i < 800; i++) assert.ok(B.sdf(a.P[i * 3] / S, a.P[i * 3 + 1] / S, a.P[i * 3 + 2] / S) < 0);
  assert.ok(a.links.length > 200 && a.links.every(i => i < 800));
  const s = B.dust(300, { shell: true });
  for (let i = 0; i < 300; i++) assert.ok(B.sdf(s.P[i * 3] / S, s.P[i * 3 + 1] / S, s.P[i * 3 + 2] / S) > -0.04, 'shell under the surface');
  assert.deepEqual(B.dustCount(22, true), { n: 1600, shell: false });
  assert.ok(B.dustCount(12, false).shell && B.dustCount(200, false).n > B.dustCount(12, false).n);
});

test('growth runs from the stem outwards', () => {
  assert.ok(B.growOf(0, -0.9, -0.32) < 0.08, 'base of the stem first');
  assert.ok(B.growOf(0, -0.16, -0.15) < B.growOf(0.3, 0.3, 0.6), 'the top of the stem before the frontal lobe');
  assert.ok(B.growOf(0.3, 0.1, 0.8) > 0.6);
});
