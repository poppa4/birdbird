/* One flight: route ↔ briefing pack ↔ desk link model.  node --test tests/flightlink.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const F = createRequire(import.meta.url)('../flightlink.js');

const route = () => ({ id: 'r1', rt: 'ENTO DCT SKI DCT ENGM', pts: [
  { n: 'ENTO', t: 'rwy', la: 59.18, lo: 10.26 }, { n: 'SKI', t: 'wpt', la: 59.4, lo: 10.6 }, { n: 'ENGM', t: 'rwy', la: 60.2, lo: 11.08 }, { n: 'ENRY', t: 'alt', la: 59.38, lo: 10.79 }] });

test('summary: departure, destination, alternate and route text', () => {
  assert.deepEqual(F.routeSummary(route()), { dep: 'ENTO', dest: 'ENGM', alt: 'ENRY', rt: 'ENTO DCT SKI DCT ENGM' });
  const r = route(); r.rt = ''; assert.equal(F.routeSummary(r).rt, 'ENTO DCT SKI DCT ENGM');
  assert.deepEqual(F.routeSummary({ pts: [] }), { dep: '', dest: '', alt: '', rt: '' });
});

test('prefill fills blanks only and links both ways', () => {
  const r = route(), p = { id: 'p1', f: { destapt: 'ENZV', type: 'DA42' } };
  F.prefill(p, r, { date: '2026-11-11' });
  assert.equal(p.f.depapt, 'ENTO'); assert.equal(p.f.destapt, 'ENZV'); assert.equal(p.f.alt1apt, 'ENRY');
  assert.equal(p.f.route, 'ENTO DCT SKI DCT ENGM'); assert.equal(p.f.date, '2026-11-11'); assert.equal(p.f.type, 'DA42');
  assert.equal(p.routeId, 'r1'); assert.equal(p.xs.route, 'r1'); assert.equal(r.packId, 'p1'); assert.equal(p.title, 'ENTO – ENZV');
  assert.match(F.prefill({ id: 'p2' }, route()).f.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('finding the pack of a route and the route of a pack (old packs only have xs.route)', () => {
  const r = route(), old = { id: 'pOld', xs: { route: 'r1' }, updated: 5 }, other = { id: 'pX', routeId: 'r9', updated: 9 };
  assert.equal(F.packForRoute([other, old], r).id, 'pOld');
  const nw = { id: 'pNew', routeId: 'r1', updated: 10 };
  assert.equal(F.packForRoute([old, nw], r).id, 'pNew');
  r.packId = 'pOld'; assert.equal(F.packForRoute([old, nw], r).id, 'pOld');
  r.packId = 'pX'; assert.equal(F.packForRoute([old, nw, other], r).id, 'pNew', 'a pack that now points at another route is not ours');
  r.packId = 'gone'; assert.equal(F.packForRoute([old], r).id, 'pOld');
  assert.equal(F.packForRoute([], r), null);
  assert.equal(F.routeForPack([r], old), r); assert.equal(F.routeForPack([r], { id: 'p' }), null);
  F.unlink(nw, r); assert.equal(nw.routeId, undefined);
});

test('sim choice and the honest label', () => {
  assert.equal(F.simFor('DA42').href, 'cockpit.html?s=air&p=ils');
  assert.equal(F.simFor('Diamond DA-42 Twin Star').k, 'da42');
  assert.equal(F.simFor('Cessna 172S').href, 'c172.html?s=air&p=ils');
  assert.equal(F.simFor('C172').k, 'c172');
  assert.equal(F.simFor('King Air').href, 'b200.html?s=air&p=ils');
  assert.equal(F.simFor('BE20').k, 'b200');
  assert.equal(F.simFor('', 'c172').k, 'c172');
  const g = F.simFor('PA-28'); assert.equal(g.k, 'da42'); assert.ok(g.guess);
  assert.match(F.simFor('DA42').en, /training airport/); assert.match(F.simFor('DA42').no, /treningsflyplass/);
});

test('aircraft match: registration first, then a type only one aircraft has', () => {
  const list = [{ id: 'a1', reg: 'LN-AAA', type: 'DA42' }, { id: 'a2', reg: 'LN-BBB', type: 'C172' }, { id: 'a3', reg: 'LN-CCC', type: 'C172' }];
  assert.equal(F.matchAircraft({ f: { reg: 'ln aaa' } }, list).id, 'a1');
  assert.equal(F.matchAircraft({ f: { type: 'DA 42' } }, list).id, 'a1');
  assert.equal(F.matchAircraft({ f: { type: 'C172' } }, list), null, 'two of that type: no guess');
  assert.equal(F.matchAircraft({ f: {} }, list), null);
});

test('desk link round trip and header', () => {
  const h = F.deskHref([['pack', 'p 1'], ['route', 'r1'], ['route', '']]);
  assert.equal(h, 'workspace.html#/desk?open=pack:p%201,route:r1');
  assert.deepEqual(F.parseOpen(h.split('open=')[1]), [['pack', 'p 1'], ['route', 'r1']]);
  assert.deepEqual(F.parseOpen('doc:x,bad,pack:'), []);
  assert.deepEqual(F.header({ f: { depapt: 'ENTO', destapt: 'ENGM', date: '2026-11-11', type: 'DA42' } }), { dep: 'ENTO', dest: 'ENGM', alt: '', date: '2026-11-11', ac: 'DA42', route: '' });
});

test('thumbnail path stays inside the box', () => {
  const t = F.thumb(route(), 120, 72);
  assert.ok(t && t.d.startsWith('M') && t.dA.startsWith('M'));
  const nums = (t.d + t.dA).match(/-?\d+(\.\d+)?/g).map(Number);
  for (let i = 0; i < nums.length; i += 2) { assert.ok(nums[i] >= 0 && nums[i] <= 120); assert.ok(nums[i + 1] >= 0 && nums[i + 1] <= 72); }
  assert.equal(F.thumb({ pts: [{ n: 'A', la: 1, lo: 1 }] }), null);
});
