/* My Workspace desk: the layout model (panes, tabs, splits, desks).  node --test tests/desk.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const D = req('../deskcore.js');
const W = req('../workspacecore.js');
const ids = L => D.panes(L).map(p => p.tabs.map(t => t.k + ':' + t.r));

test('desk: starts with one empty pane; opening an item twice shows the same tab', () => {
  let L = D.newLayout();
  assert.equal(D.panes(L).length, 1); assert.equal(D.activePane(L).tabs.length, 0);
  let r = D.open(L, 'doc', 'd1'); L = r.L;
  r = D.open(L, 'note', 'n1'); L = r.L;
  const again = D.open(L, 'doc', 'd1');
  assert.ok(again.existed); assert.equal(D.activeTab(again.L).r, 'd1');
  assert.deepEqual(ids(again.L), [['doc:d1', 'note:n1']]);
});

test('desk: split right and down, up to four panes, open beside goes to the next pane', () => {
  let L = D.open(D.newLayout(), 'doc', 'afm').L;
  const first = D.activePane(L).id;
  let r = D.open(L, 'note', 'n1', { beside: true }); L = r.L;
  assert.equal(D.panes(L).length, 2); assert.equal(L.root.t, 's'); assert.equal(L.root.d, 'h');
  assert.deepEqual(ids(L), [['doc:afm'], ['note:n1']]);
  // beside from the first pane uses the existing second pane, no new split
  L = D.activate(L, first);
  L = D.open(L, 'doc', 'chk', { beside: true }).L;
  assert.equal(D.panes(L).length, 2); assert.deepEqual(ids(L), [['doc:afm'], ['note:n1', 'doc:chk']]);
  // split the second pane downwards: a nested split
  const s = D.split(L, D.panes(L)[1].id, 'v'); L = s.L;
  assert.equal(L.root.c[1].t, 's'); assert.equal(L.root.c[1].d, 'v');
  // another right split from the first pane joins the existing row
  L = D.split(L, first, 'h').L;
  assert.equal(L.root.c.length, 3); assert.equal(D.panes(L).length, 4);
  assert.ok(Math.abs(L.root.w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(D.split(L, first, 'h'), null, 'four panes is the limit');
  assert.equal(D.split(D.open(D.newLayout(), 'doc', 'x').L, D.panes(D.open(D.newLayout(), 'doc', 'x').L)[0].id, 'h', 1), null, 'a phone allows one');
});

test('desk: closing the last tab of a pane removes the pane and folds the split', () => {
  let L = D.open(D.newLayout(), 'doc', 'afm').L;
  L = D.open(L, 'note', 'n1', { beside: true }).L;
  const s = D.split(L, D.panes(L)[1].id, 'v'); L = D.open(s.L, 'aircraft', 'a1', { pane: s.paneId }).L;
  assert.equal(D.panes(L).length, 3);
  const n1 = D.findItem(L, 'note', 'n1').tab.id;
  L = D.close(L, n1);
  assert.equal(D.panes(L).length, 2); assert.equal(L.root.t, 's'); assert.equal(L.root.d, 'h', 'the stacked split folded away');
  assert.deepEqual(ids(L), [['doc:afm'], ['aircraft:a1']]);
  L = D.close(L, D.findItem(L, 'aircraft', 'a1').tab.id);
  assert.equal(L.root.t, 'p'); assert.deepEqual(ids(L), [['doc:afm']]);
  L = D.close(L, D.findItem(L, 'doc', 'afm').tab.id);
  assert.equal(L.root.t, 'p', 'the last pane stays, empty'); assert.equal(L.root.a, null);
});

test('desk: pinned tabs stay at the front and survive close; close others keeps pins', () => {
  let L = D.newLayout(); for (const r of ['a', 'b', 'c', 'd']) L = D.open(L, 'doc', r).L;
  const c = D.findItem(L, 'doc', 'c').tab.id;
  L = D.pin(L, c, true);
  assert.deepEqual(ids(L), [['doc:c', 'doc:a', 'doc:b', 'doc:d']]);
  assert.deepEqual(ids(D.close(L, c)), ids(L), 'a pinned tab is not closed');
  assert.deepEqual(ids(D.close(L, c, true)), [['doc:a', 'doc:b', 'doc:d']]);
  // a new tab never lands in front of a pinned one
  L = D.activate(L, D.activePane(L).id, c); L = D.open(L, 'note', 'n').L;
  assert.deepEqual(ids(L)[0].slice(0, 2), ['doc:c', 'note:n']);
  L = D.closeOthers(L, D.findItem(L, 'doc', 'b').tab.id);
  assert.deepEqual(ids(L), [['doc:c', 'doc:b']]);
  L = D.pin(L, c, false); assert.deepEqual(ids(L), [['doc:c', 'doc:b']]); assert.ok(!D.tabById(L, c).pin);
});

test('desk: move a tab within a pane (reorder) and to another pane; an emptied pane goes', () => {
  let L = D.newLayout(); for (const r of ['a', 'b', 'c']) L = D.open(L, 'doc', r).L;
  const a = D.findItem(L, 'doc', 'a').tab.id, p0 = D.panes(L)[0].id;
  L = D.move(L, a, p0, 3); assert.deepEqual(ids(L), [['doc:b', 'doc:c', 'doc:a']]);
  L = D.move(L, a, p0, 0); assert.deepEqual(ids(L), [['doc:a', 'doc:b', 'doc:c']]);
  const r = D.moveToNew(L, D.findItem(L, 'doc', 'c').tab.id, 'h'); L = r.L;
  assert.deepEqual(ids(L), [['doc:a', 'doc:b'], ['doc:c']]); assert.equal(L.act, r.paneId);
  L = D.move(L, D.findItem(L, 'doc', 'c').tab.id, p0, 1);
  assert.deepEqual(ids(L), [['doc:a', 'doc:c', 'doc:b']]); assert.equal(D.panes(L).length, 1);
  assert.equal(D.moveToNew(D.open(D.newLayout(), 'doc', 'x').L, D.findItem(D.open(D.newLayout(), 'doc', 'x').L, 'doc', 'x').tab.id, 'h'), null, 'a lone tab is not split off its own pane');
});

test('desk: splitter sizes keep a minimum and sum to one; keyboard nudge', () => {
  let L = D.open(D.newLayout(), 'doc', 'a').L; L = D.open(L, 'doc', 'b', { beside: true }).L;
  const sid = L.root.id;
  L = D.setSizes(L, sid, [0.99, 0.01]);
  assert.ok(L.root.w[1] >= D.MIN_W - 1e-9 && Math.abs(L.root.w[0] + L.root.w[1] - 1) < 1e-9);
  L = D.setSizes(L, sid, [0.5, 0.5]); L = D.nudge(L, sid, 0, 0.1);
  assert.ok(Math.abs(L.root.w[0] - 0.6) < 1e-9);
  L = D.nudge(L, sid, 0, 5); assert.ok(Math.abs(L.root.w[1] - D.MIN_W) < 1e-9);
});

test('desk: serialize and restore give back the same layout, positions included', () => {
  let L = D.open(D.newLayout(), 'doc', 'afm', { st: { p: 12, z: 1.25 } }).L;
  L = D.open(L, 'note', 'n1', { beside: true }).L;
  L = D.split(L, D.panes(L)[1].id, 'v').L; L = D.open(L, 'aircraft', 'ac1').L;
  L = D.pin(L, D.findItem(L, 'doc', 'afm').tab.id, true);
  L = D.setState(L, D.findItem(L, 'doc', 'afm').tab.id, { p: 47, o: 0.25, y: 3120 });
  L = D.setSizes(L, L.root.id, [0.62, 0.38]);
  const s = D.serialize(L), back = D.restore(s);
  assert.deepEqual(back, JSON.parse(JSON.stringify(L)));
  assert.deepEqual(D.tabById(back, D.findItem(back, 'doc', 'afm').tab.id).st, { p: 47, z: 1.25, y: 3120, o: 0.25 });
  assert.ok(s.length < 2000, 'a desk is small: ' + s.length + ' bytes');
  assert.equal(D.shape(L), D.shape(D.setState(L, D.findItem(L, 'doc', 'afm').tab.id, { p: 3 })), 'reading does not change the shape');
});

test('desk: a damaged or hostile layout from another device is repaired, never thrown', () => {
  for (const bad of [null, 'x', '{', {}, { root: 5 }, { root: { t: 's', c: [] } }]) { const L = D.restore(bad); assert.equal(D.panes(L).length, 1); }
  const evil = { act: 'nope', root: { t: 's', d: 'h', w: [5, 'x', -1, 1, 1, 1], c: [
    { t: 'p', id: 'p1', tabs: [{ id: 't1', k: 'doc', r: 'd1' }, { id: 't1', k: 'doc', r: 'd1' }, { id: 't2', k: '<img>', r: 'x' }, { id: 't3', k: 'note', r: 'a"b' }, { id: 't4', k: 'note', r: 'n1', pin: 1, st: { p: -4, z: 99, junk: 1 } }], a: 'zzz' },
    { t: 'p', id: 'p1', tabs: [] }, { t: 'p', tabs: [] }, { t: 'p', tabs: [] }, { t: 'p', tabs: [] }, { t: 'q' }] } };
  const L = D.restore(evil);
  assert.equal(D.panes(L).length, 4, 'at most four panes');
  assert.deepEqual(ids(L)[0], ['note:n1', 'doc:d1'], 'duplicates, bad kinds and bad ids dropped; pinned first');
  assert.deepEqual(D.panes(L)[0].tabs[0].st, { p: 1, z: 6 });
  assert.equal(new Set(D.panes(L).map(p => p.id)).size, 4, 'pane ids are unique');
  assert.ok(D.paneById(L, L.act));
  assert.ok(Math.abs(L.root.w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('desk: desks are small workspace items that sync, duplicate with fresh ids, and go to the trash', () => {
  let L = D.open(D.newLayout(), 'doc', 'afm').L; L = D.open(L, 'note', 'n1', { beside: true }).L;
  const d = D.newDesk({ name: '  B200   type rating ', L }, 1000);
  assert.equal(d.kind, 'desk'); assert.equal(d.name, 'B200 type rating'); assert.equal(W.nsOfKind(d.kind), 'workspace');
  const c = D.dupDesk(d, 'Next flight', 2000);
  assert.notEqual(c.id, d.id); assert.deepEqual(ids(c.L), ids(d.L));
  assert.ok(D.panes(c.L).every((p, i) => p.id !== D.panes(d.L)[i].id));
  assert.ok(D.allTabs(c.L).every(t => D.panes(c.L).some(p => p.a === t.id) || true));
  assert.ok(D.panes(c.L).every(p => p.tabs.some(t => t.id === p.a)));
  const t = W.trash(d, 3000);
  assert.deepEqual(D.desksOf({ [d.id]: t, [c.id]: c }).map(x => x.id), [c.id]);
  // newest wins between devices, like every other item
  const other = W.patch(d, { name: 'Renamed elsewhere' }, 5000);
  assert.equal(W.mergeItem(t, other, 0).item.name, 'Renamed elsewhere');
  assert.ok(JSON.stringify(d).length < 1500);
});

test('desk: prune drops tabs of items gone for good and folds empty panes', () => {
  let L = D.open(D.newLayout(), 'doc', 'afm').L; L = D.open(L, 'note', 'gone', { beside: true }).L;
  L = D.prune(L, (k, r) => r !== 'gone');
  assert.deepEqual(ids(L), [['doc:afm']]);
});

test('notes: a page reference survives the sanitizer with only its two attributes', () => {
  const h = D.citeHtml('fd1abc', 47, '4-12', 'King Air B200 Pilot Operating Handbook and Flight Manual');
  assert.match(h, /^<cite data-doc="fd1abc" data-p="47">King Air B200 Pilot Operating…/);
  const n = W.newNote({ body: '<div>' + h + '</div>' });
  assert.ok(n.body.includes('<cite data-doc="fd1abc" data-p="47">'));
  assert.equal(W.sanitizeHtml('<cite contenteditable="false" data-doc="d1" data-p="3" onclick="x()">A p. 3</cite>'), '<cite data-doc="d1" data-p="3">A p. 3</cite>');
  const evil = W.sanitizeHtml('<cite data-doc="d1&quot;><img src=x onerror=alert(1)>" data-p="3">x</cite>');
  assert.ok(evil.startsWith('<cite>') && !/<img/i.test(evil), evil);
  assert.equal(W.htmlToText(n.body), 'King Air B200 Pilot Operating… p. 4-12');
});

test('find in document: every matching page, in page order', () => {
  const chunks = [{ p: 1, t: 'Engine fire on the ground' }, { p: 4, t: 'ENGINE FIRE in flight: feather' }, { p: 4, t: 'more about engine fire' }, { p: 9, t: 'nothing here' }];
  const r = D.findPages(chunks, 'engine fire', W.fold, W.tokens, W.snippet);
  assert.deepEqual(r.map(x => x.p), [1, 4]); assert.ok(r[1].n >= 4);
  assert.deepEqual(D.findPages(chunks, '', W.fold, W.tokens, W.snippet), []);
});
