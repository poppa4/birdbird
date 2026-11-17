import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const F = require('../flowscore.js'), A = require('../flowsac.js');
test('every example flow points at controls that exist', () => { for (const ac of A.list) { const f = F.example(ac.id, A); assert.ok(f, ac.id); f.steps.filter(s => s.k === 'act').forEach(s => assert.ok(s.tg && A.byId(ac, s.tg), ac.id + ' ' + s.t)); } });
test('controls do not overlap inside a panel and stay inside the drawing', () => { for (const ac of A.list) { const T = A.targets(ac).filter(t => !t.whole);
  T.forEach(t => { assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000 && t.y + t.h <= ac.h, ac.id + ' ' + t.id); assert.ok(t.w > 10 && t.h > 8, ac.id + ' small ' + t.id); });
  const ids = new Set(); A.targets(ac).forEach(t => { assert.ok(!ids.has(t.id), 'dup ' + t.id); ids.add(t.id); }); } });
test('a tap on a control finds it; check() accepts a tap on the control and refuses one far away', () => { const ac = A.get('a320'), t = A.byId(ac, 'ELEC|BAT 1');
  assert.equal(A.hit(ac, t.x + 3, t.y + 3).id, 'ELEC|BAT 1');
  const s = { x: t.x + t.w / 2, y: t.y + t.h / 2, tg: t.id }; assert.ok(F.check(s, t.x + t.w - 2, t.y + 2, ac, A).ok); assert.ok(!F.check(s, t.x + 300, t.y, ac, A).ok);
  assert.ok(F.check({ x: 100, y: 100 }, 130, 110).ok); assert.ok(!F.check({ x: 100, y: 100 }, 200, 100).ok); });
test('SOP text becomes steps; checklist lines become calls', () => { const s = F.parseSop('BEFORE START:\n1. Battery ........ ON\n– Beacon   ON\n• Fuel pumps – ON\n\nBEFORE START CHECKLIST\n');
  assert.deepEqual(s.map(x => x.t), ['Battery – ON', 'Beacon – ON', 'Fuel pumps – ON', 'BEFORE START CHECKLIST']); assert.equal(s[3].k, 'call'); });
test('share link round trip keeps steps and drops the photo', () => { const f = F.example('a320', A); f.img = { id: 'local', w: 800, h: 600, name: 'x.jpg' }; f.steps[0].after = f.steps[3].id;
  const g = F.decode(F.encode(f)); assert.equal(g.steps.length, f.steps.length); assert.equal(g.steps[0].after, f.steps[3].id); assert.equal(g.img.id, ''); assert.equal(F.decode('###'), null); });
test('roles: moving a step only swaps with its own layer; waiting steps', () => { const f = F.newFlow('a320'); const a = F.addStep(f, { r: 'PF', t: 'a' }), b = F.addStep(f, { r: 'PM', t: 'b' }), c = F.addStep(f, { r: 'PF', t: 'c', after: b.id });
  F.moveStep(f, c.id, -1); assert.deepEqual(f.steps.map(s => s.t), ['c', 'a', 'b']); assert.deepEqual(F.nextFor(f, 'PF', {}), { s: c, blocked: true });
  assert.deepEqual(F.nextFor(f, 'PF', { [b.id]: 1 }), { s: c, blocked: false }); F.delStep(f, b.id); assert.equal(c.after, undefined); });
test('clean() refuses junk and limits sizes', () => { assert.equal(F.clean(null), null); const g = F.clean({ name: 'x'.repeat(500), steps: [{ r: 'HACK', t: '<b>', x: 'a' }], style: { col: { PF: 'red' }, lw: 99 } });
  assert.equal(g.name.length, 80); assert.equal(g.steps[0].r, 'PF'); assert.equal(g.steps[0].x, null); assert.equal(g.style.lw, 8); assert.equal(g.style.col.PF, F.COLORS[0]); });
test('cockpit photos: files exist, sizes match, ids fit a flow, credit present', async () => { const fs = await import('node:fs'); for (const p of A.photos) { assert.ok(p.id.length <= 12, p.id); assert.ok(fs.existsSync(new URL('../' + p.file, import.meta.url)), p.file); assert.ok(p.by && /^CC BY/.test(p.lic) && /^https:\/\/commons\.wikimedia\.org\//.test(p.src), p.id); assert.ok(A.get(p.ac), p.ac); assert.equal(A.photo(p.id), p); } });
test('rendered cockpit: picture files exist, credit and licence present, every control inside the picture and big enough to tap', async () => { const fs = await import('node:fs'); const ac = A.get('a320');
  assert.ok(ac.img && /GPL/.test(ac.img.lic) && ac.img.by && ac.img.src); for (const f of [ac.img.lo, ac.img.hi]) assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), f);
  const T = A.targets(ac); assert.ok(T.length > 400); T.forEach(t => { assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000 && t.y + t.h <= ac.h, t.id); if (!t.whole) { const c = A.hit(ac, t.x + t.w / 2, t.y + t.h / 2); assert.equal(c.id, t.id, 'centre of ' + t.id + ' hits ' + c.id); } });
  assert.ok(A.svg(ac).includes(ac.img.lo) && A.svg(ac).includes('GPL-2.0')); assert.ok(fs.existsSync(new URL('../tools/render-a320/README.md', import.meta.url))); });

test('own picture: a named spot works like a built-in control (name once, reuse, rename, remove, survives a file round trip)', () => {
  const f = F.newFlow('img', { roles: 'pfpm' }); f.img = { id: 'img-1', w: 2000, h: 1500, name: 'deck.jpg' };
  const a = F.addStep(f, { x: 100, y: 200 }), b = F.addStep(f, { x: 500, y: 600 }), c = F.addStep(f, { x: 300, y: 300 });
  F.nameSpot(f, a, ' BAT 1 '); assert.deepEqual(f.marks, [{ n: 'BAT 1', x: 100, y: 200 }]); assert.equal(a.tg, 'BAT 1'); assert.equal(a.t, 'BAT 1');
  F.nameSpot(f, b, 'bat 1'); assert.equal(b.tg, 'BAT 1'); assert.deepEqual([b.x, b.y], [100, 200]); assert.equal(f.marks.length, 1);      // an existing name: the step goes to that control
  F.nameSpot(f, c, 'BEACON'); const ac = F.ownAc(f, 750, '');
  assert.equal(A.hit(ac, 101, 203, 2).id, 'BAT 1'); assert.equal(A.hit(ac, 150, 200, 2), null); assert.equal(A.byId(ac, 'BEACON').name, 'BEACON');
  assert.ok(F.check(a, 104, 204, ac, A, 10).ok); assert.ok(!F.check(a, 160, 200, ac, A, 10).ok);
  F.nameSpot(f, a, 'BATTERY 1'); assert.equal(b.tg, 'BATTERY 1'); assert.equal(a.t, 'BATTERY 1'); assert.equal(f.marks.length, 2);            // rename everywhere
  const g = F.decode(F.encode(f)); assert.deepEqual(g.marks, f.marks); assert.equal(g.steps[0].tg, 'BATTERY 1');
  F.nameSpot(f, a, ''); assert.equal(a.tg, undefined); assert.equal(b.tg, undefined); assert.deepEqual(f.marks.map(m => m.n), ['BEACON']);
  assert.equal(F.clean({ ac: 'img', marks: [{ n: 'A|<b>', x: 1, y: 2 }, { n: 'a b', x: 3, y: 4 }, { n: '', x: 1, y: 1 }, { n: 'Z' }] }).marks.length, 1);
});

test('a step text gives the control and its position; choices hold the right one once; review intervals grow and reset', () => {
  assert.deepEqual(F.stateOf('BAT 1+2 – ON'), { n: 'BAT 1+2', st: 'ON' }); assert.deepEqual(F.stateOf('APU BLEED - AS RQRD'), { n: 'APU BLEED', st: 'AS RQRD' }); assert.deepEqual(F.stateOf('ANTI-ICE'), { n: 'ANTI-ICE', st: '' }); assert.equal(F.stateOf('').st, '');
  const f = F.newFlow('a320'); F.addStep(f, { t: 'BAT 1 – ON' }); F.addStep(f, { t: 'APU MASTER – ON' }); F.addStep(f, { t: 'PACK FLOW – AUTO' }); F.addStep(f, { t: 'BEACON' });
  const c = F.stateChoices(f, f.steps[0]); assert.equal(c.length, 4); assert.equal(c.filter(x => x === 'ON').length, 1); assert.ok(c.includes('AUTO')); assert.equal(new Set(c.map(x => x.toUpperCase())).size, 4); assert.deepEqual(F.stateChoices(f, f.steps[3]), []);
  const D = 864e5; let o = F.reviewNext(null, 95, 0); assert.deepEqual([o.n, o.due], [1, D]); o = F.reviewNext(o, 100, 0); assert.equal(o.due, 3 * D); o = F.reviewNext(o, 92, 0); assert.equal(o.due, 7 * D);
  o = F.reviewNext(o, 60, 5); assert.deepEqual([o.n, o.due], [0, 5]); for (let i = 0; i < 9; i++) o = F.reviewNext(o, 100, 0); assert.equal(o.due, 30 * D);
});

test('every pictured cockpit: files exist, credit present, every control inside the picture, unique, and its centre hits itself', async () => { const fs = await import('node:fs');
  for (const ac of A.list.filter(a => a.img)) { assert.ok(ac.img.by && ac.img.lic && ac.img.src, ac.id); for (const f of [ac.img.lo, ac.img.hi]) assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), f);
    const T = A.targets(ac), ids = new Set(); assert.ok(T.length >= 40, ac.id); for (const t of T) { assert.ok(!ids.has(t.id), ac.id + ' twice: ' + t.id); ids.add(t.id);
      assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000.5 && t.y + t.h <= ac.h + 0.5, ac.id + ' outside: ' + t.id); if (!t.whole) { const c = A.hit(ac, t.x + t.w / 2, t.y + t.h / 2); assert.equal(c && c.id, t.id, ac.id + ': centre of ' + t.id); } }
    assert.ok(A.groups.some(g => g.list.includes(ac)), ac.id + ' is in a group'); } });
test('every ready-made library flow points at controls that exist, has a known phase and builds', () => { const L = F.stdList(); assert.ok(L.length >= 10);
  for (const e of L) { const ac = A.get(e.ac); assert.ok(ac, e.id); assert.ok(F.PHASES.some(p => p[0] === e.phase), e.id); const f = F.stdFlow(e.id, A); assert.ok(f && f.steps.length === e.n, e.id);
    f.steps.forEach(s => assert.ok(s.tg && A.byId(ac, s.tg) && s.x != null, e.id + ' · ' + s.t)); assert.ok(F.clean(f), e.id); } assert.equal(F.stdFlow('bb:nope:x', A), null); });
