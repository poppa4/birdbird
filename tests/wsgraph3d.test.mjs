/* My Workspace map in 3D: a cloud of points, a soft ball per group.  node --test tests/wsgraph3d.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const M = req('../wsgraph.js');
const B = req('../wsgraph3d.js');
const SAMPLE = () => M.buildGraph(M.sampleInput(), { pages: false, desks: false });
const at = (L, i) => [L.P[i * 3], L.P[i * 3 + 1], L.P[i * 3 + 2]];
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
/* every point in its own group's ball, the balls apart, the points apart */
function check(g, L, tag) {
  g.nodes.forEach((n, i) => { const c = L.clusters[L.gi[i]]; assert.ok(dist(at(L, i), c.c) <= c.r + 1e-4, tag + ' inside its ball: ' + n.id);
    assert.equal(c.ac >= 0 ? g.nodes[c.ac].id : '', n.ac && g.index[n.ac] != null ? n.ac : '', tag + ' grouped by aircraft: ' + n.id); });
  for (let a = 0; a < L.clusters.length; a++) for (let b = a + 1; b < L.clusters.length; b++) { const p = L.clusters[a], q = L.clusters[b]; assert.ok(dist(p.c, q.c) >= p.r + q.r + L.D, tag + ' balls apart'); }
  let md = Infinity; for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) md = Math.min(md, dist(at(L, i), at(L, j)));
  if (g.nodes.length > 1) assert.ok(md >= 0.55 * L.D, tag + ' points apart: ' + md.toFixed(2));
}

test('example: three soft balls, one per aircraft, deterministic, the aircraft in the middle', () => {
  const g = SAMPLE(), a = B.layout3d(g), b = B.layout3d(SAMPLE());
  assert.ok(g.nodes.length >= 20 && g.nodes.length <= 25);
  assert.deepEqual([...a.P], [...b.P], 'the same workspace, the same cloud');
  assert.deepEqual(a.clusters.map(c => g.nodes[c.ac].label), ['LN-EXA', 'LN-EXB', 'LN-EXC']);
  assert.deepEqual(a.clusters.map(c => c.n), [7, 6, 6]);
  a.clusters.forEach(c => assert.ok(dist(at(a, c.ac), c.c) < 1e-6, 'aircraft in the middle'));
  check(g, a, 'example');
  assert.ok(a.grow.every(v => v >= 0 && v <= 1), 'growth 0..1');
  assert.ok(new Set(a.clusters.map(c => c.c[2].toFixed(2))).size > 1, 'groups at different depths (parallax)');
});

test('own maps: a ball per aircraft plus Unsorted, points apart; a large map is laid out quickly', () => {
  for (const n of [1, 3, 12, 40, 300]) {
    const g = OWN(n), L = B.layout3d(g);
    assert.equal(L.clusters.length, g.counts.aircraft + (g.nodes.some(x => !x.ac) ? 1 : 0), 'groups (' + n + ')');
    check(g, L, 'own ' + n);
  }
  const L12 = B.layout3d(OWN(12)), u = L12.clusters[L12.clusters.length - 1]; assert.equal(u.ac, -1);
  const items = {}; for (let i = 0; i < 5; i++) items['n' + i] = { id: 'n' + i, kind: 'note', title: 'x' + i, createdAt: i };
  const L2 = B.layout3d(M.buildGraph({ items }, { pages: false, desks: false })); assert.equal(L2.clusters.length, 1); assert.equal(L2.clusters[0].ac, -1);
  const t0 = performance.now(); const g6 = OWN(600), L6 = B.layout3d(g6); assert.ok(performance.now() - t0 < 1500); check(g6, L6, 'own 600');
});

test('the cloud follows the plate; the soft light sits on the groups', () => {
  const g = SAMPLE(), wide = B.layout3d(g, { aspect: 2 }), tall = B.layout3d(g, { aspect: 0.6 });
  assert.equal(wide.cols, 3); assert.ok(tall.cols < 3); check(g, tall, 'tall');
  const P = B.puffs(wide.clusters); assert.equal(P.length % 5, 0); assert.ok(P.length / 5 >= wide.clusters.length * 7);
  for (let k = 0; k < P.length; k += 5) { const c = wide.clusters[P[k + 4]]; assert.ok(dist([P[k], P[k + 1], P[k + 2]], c.c) <= c.r + B.D, 'puff on its group'); }
  assert.deepEqual([...P], [...B.puffs(B.layout3d(SAMPLE(), { aspect: 2 }).clusters)], 'deterministic');
});

test('growth runs from the middle of the cloud outwards', () => {
  const g = SAMPLE(), L = B.layout3d(g);
  const mid = L.clusters.map(c => c.ac).sort((a, b) => L.grow[a] - L.grow[b])[0], far = L.grow.reduce((m, v) => Math.max(m, v), 0);
  assert.ok(L.grow[mid] < far, 'the middle first');
});
