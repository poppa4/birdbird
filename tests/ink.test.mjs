/* Pen notebook and PDF ink: the pure core (inkcore.js).  node --test tests/ink.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const I = req('../inkcore.js');
const W = req('../workspacecore.js');
const T0 = Date.UTC(2026, 10, 11, 9, 0, 0), MIN = 60e3;
const line = (x0, y0, x1, y1, n, p) => { const a = []; for (let i = 0; i <= n; i++) a.push(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), p == null ? 16 : p); return a; };

test('points: delta + zigzag coding round-trips exactly and is compact', () => {
  const pts = [0, 0, 0, 2099, 2969, 31, 2098, 2970, 0, 5, -3, 12, 1000, 1000, 16];
  assert.deepEqual(I.decodePts(I.encodePts(pts)), pts);
  const long = line(100, 200, 1900, 2600, 300, 20);
  const s = I.encodePts(long);
  assert.deepEqual(I.decodePts(s), long);
  assert.ok(s.length / (long.length / 3) < 5, 'about 3–4 characters per point: ' + s.length / (long.length / 3));
  assert.match(s, /^[A-Za-z0-9_-]+$/, 'only URL- and JSON-safe characters');
  assert.equal(I.decodePts('!!'), null); assert.equal(I.decodePts('B'), null, 'a dangling continuation is rejected');
});

test('strokes: serialise and parse; bad strings are refused', () => {
  const st = { t: 'p', c: '#1D4E9E', w: 16, s: 0, pts: line(10, 10, 300, 40, 12, 22) };
  const s = I.encodeStroke(st), d = I.decodeStroke(s);
  assert.match(s, /^p\|1D4E9E\|16\|0\|/);
  assert.deepEqual({ t: d.t, c: d.c, w: d.w, s: d.s, pts: d.pts }, st);
  const h = I.decodeStroke(I.encodeStroke({ t: 'h', c: '#F5D90A', w: 140, s: 1, pts: [5, 5, 16] }));
  assert.equal(h.t, 'h'); assert.equal(h.s, 1);
  for (const bad of ['', 'x|000000|1|0|AA', 'p|zzzzzz|1|0|AAA', 'p|000000|1|0', 'p|000000|1|0|!!!', 42, null]) assert.equal(I.decodeStroke(bad), null, String(bad));
  assert.deepEqual(I.cleanInk([s, 'junk', 7, s]), [s, s]);
});

test('outline: closed smooth polygon, wider with more pressure, a dot is a circle', () => {
  const soft = I.outline(line(0, 0, 1000, 0, 40, 4), { size: 20 }), hard = I.outline(line(0, 0, 1000, 0, 40, 31), { size: 20 });
  const thick = poly => { const ys = poly.filter(p => p[0] > 300 && p[0] < 700).map(p => p[1]); return Math.max(...ys) - Math.min(...ys); };
  assert.ok(thick(hard) > thick(soft) * 1.5, `pressure widens the line (${thick(soft)} -> ${thick(hard)})`);
  assert.ok(Math.abs(thick(hard) - 30) < 6, 'full pressure ≈ 1.5 × half the size on each side: ' + thick(hard));
  for (const p of hard) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const xs = hard.map(p => p[0]); assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > 990, 'round caps reach past both ends');
  const dot = I.outline([500, 500, 16], { size: 20 });
  dot.forEach(p => assert.ok(Math.abs(Math.hypot(p[0] - 500, p[1] - 500) - dot.reduce((a, q) => a + Math.hypot(q[0] - 500, q[1] - 500), 0) / dot.length) < 0.01));
  const path = I.toPath(hard); assert.match(path, /^M[\d.\- ]+(Q[\d.\- ]+)+Z$/);
  /* a mouse (no pressure): thickness comes from speed and stays within bounds */
  const sim = I.outline(line(0, 0, 1000, 0, 10), { size: 20, simulate: true }); assert.ok(thick(sim) > 4 && thick(sim) < 32, 'simulated: ' + thick(sim));
  /* a hand that shakes: streamlining keeps the outline close to the intent */
  const shaky = []; for (let i = 0; i <= 60; i++) shaky.push(i * 20, (i % 2 ? 6 : -6), 20);
  const ys = I.outline(shaky, { size: 16, streamline: 0.6 }).filter(p => p[0] > 200 && p[0] < 1000).map(p => Math.abs(p[1]));
  assert.ok(Math.max(...ys) < 20, 'smoothed wobble: ' + Math.max(...ys));
});

test('eraser: hit test, whole-stroke and partial', () => {
  const st = { t: 'p', c: '#000000', w: 10, s: 0, pts: [0, 0, 16, 1000, 0, 16] };
  assert.ok(I.hitStroke(st, 500, 30, 30), 'radius + half width reaches it');
  assert.ok(!I.hitStroke(st, 500, 60, 30));
  assert.ok(!I.hitStroke(st, 1200, 0, 30), 'beyond the end');
  assert.ok(I.hitStroke({ t: 'p', c: '#000000', w: 10, s: 0, pts: [50, 50, 16] }, 70, 50, 20), 'a dot');
  assert.equal(I.eraseStroke(st, 500, 200, 30), null, 'untouched stays');
  const parts = I.eraseStroke(st, 500, 0, 40);
  assert.equal(parts.length, 2, 'a segment with no point under the eraser is still cut in two');
  const [a, b] = parts, ax = a.pts.filter((v, i) => i % 3 === 0), bx = b.pts.filter((v, i) => i % 3 === 0);
  assert.equal(ax[0], 0); assert.ok(Math.max(...ax) < 470); assert.ok(Math.min(...bx) > 530); assert.equal(bx[bx.length - 1], 1000);
  assert.deepEqual(I.eraseStroke(st, 0, 0, 3000), [], 'rubbed out completely');
  assert.equal(a.c, '#000000'); assert.equal(a.w, 10);
});

test('lasso and moving', () => {
  const st = { t: 'p', c: '#000000', w: 10, s: 0, pts: line(100, 100, 300, 120, 20) };
  const box = [[50, 50], [400, 50], [400, 200], [50, 200]];
  assert.ok(I.lassoHit(st, box)); assert.ok(!I.lassoHit(st, [[250, 0], [600, 0], [600, 300], [250, 300]]), 'mostly outside');
  assert.ok(I.inPoly(10, 10, [[0, 0], [20, 0], [20, 20], [0, 20]])); assert.ok(!I.inPoly(30, 10, [[0, 0], [20, 0], [20, 20], [0, 20]]));
  const m = I.moveStroke(st, 50, -20); assert.equal(m.pts[0], 150); assert.equal(m.pts[1], 80); assert.equal(st.pts[0], 100, 'the original is untouched');
  assert.equal(I.recolor(st, '#C0322B').c, '#C0322B');
  const bb = I.bbox(st); assert.ok(bb.x <= 90 && bb.w >= 210);
});

test('notebook: pages, paper per notebook and per page, templates', () => {
  let nb = I.newNotebook({ title: '  IR  renewal ', paper: 'grid' }, T0);
  assert.equal(nb.kind, 'notebook'); assert.equal(nb.title, 'IR renewal'); assert.equal(nb.pages.length, 1); assert.equal(I.paperOf(nb, nb.pages[0]), 'grid');
  assert.equal(W.nsOfKind('notebook'), 'ink'); assert.equal(W.nsOfKind('ink'), 'ink'); assert.equal(W.nsOfKind('note'), 'notes');
  nb = I.addPage(nb, null, 'approach'); nb = I.addPage(nb, 1);
  assert.deepEqual(nb.pages.map(p => I.paperOf(nb, p)), ['grid', 'grid', 'approach']);
  nb.pages[0] = Object.assign({}, nb.pages[0], { ink: [I.encodeStroke({ t: 'p', c: '#000000', w: 16, s: 0, pts: [1, 2, 3] })], tx: [{ id: 't1', x: 10, y: 10, w: 500, fs: 44, s: 'QNH 1013' }] });
  nb = I.duplicatePage(nb, 0);
  assert.equal(nb.pages.length, 4); assert.deepEqual(nb.pages[1].ink, nb.pages[0].ink); assert.notEqual(nb.pages[1].id, nb.pages[0].id); assert.notEqual(nb.pages[1].tx[0].id, 't1');
  const ids = nb.pages.map(p => p.id);
  nb = I.movePage(nb, 3, 0); assert.deepEqual(nb.pages.map(p => p.id), [ids[3], ids[0], ids[1], ids[2]]);
  nb = I.setPaper(nb, 1, 'approach'); assert.equal(I.paperOf(nb, nb.pages[1]), 'approach');
  nb = I.setPaper(nb, null, 'lined'); assert.equal(I.paperOf(nb, nb.pages[2]), 'lined'); assert.equal(I.paperOf(nb, nb.pages[1]), 'approach', 'a page with its own paper keeps it');
  nb = I.setPaper(nb, null, 'dots', true); assert.ok(nb.pages.every(p => I.paperOf(nb, p) === 'dots'));
  assert.equal(I.setPaper(nb, 0, 'wallpaper'), nb, 'unknown paper is ignored');
  nb = I.deletePage(nb, 0); assert.equal(nb.pages.length, 3);
  let one = I.newNotebook({}, T0); one = I.deletePage(one, 0); assert.equal(one.pages.length, 1, 'never zero pages');
  assert.equal(I.notebookText(I.newNotebook({}, T0)), '');
  assert.match(I.notebookText({ pages: [{ tx: [{ s: 'QNH 1013' }] }] }), /QNH 1013/);
  /* templates are vector drawings in page units, with the aviation labels */
  const label = (paper, lang) => I.paperPrims(paper, I.PH, lang).filter(p => p.k === 'text').map(p => p.t).join(' | ');
  assert.ok(!I.PAPERS || (!I.PAPERS.includes('craft') && !I.PAPERS.includes('kneeboard')), 'no in-flight templates');
  for (const w of ['PROCEDURE', 'MINIMA', 'MSA', 'ATIS', 'MISSED APPROACH', 'DA / MDA']) assert.ok(label('approach').includes(w), w);
  assert.ok(label('approach', 'no').includes('AVBRUTT INNFLYGING'), 'Norwegian labels');
  const grid = I.paperPrims('grid', I.PH).filter(p => p.k === 'line');
  assert.ok(grid.length > 90 && grid.every(l => l.x1 % 50 === 0 && l.y1 % 50 === 0), '5 mm grid');
  assert.equal(I.paperPrims('dots', I.PH)[0].dx, 50); assert.ok(I.paperPrims('lined', I.PH).length > 30); assert.deepEqual(I.paperPrims('blank', I.PH), []);
  for (const paper of I.PAPERS) for (const p of I.paperPrims(paper, I.PH)) {
    const xs = [p.x, p.x1, p.x2].filter(v => v != null), ys = [p.y, p.y1, p.y2].filter(v => v != null);
    xs.forEach(v => assert.ok(v >= 0 && v <= I.PW, paper + ' x ' + v)); ys.forEach(v => assert.ok(v >= 0 && v <= I.PH, paper + ' y ' + v));
    if (p.k === 'rect') { assert.ok(p.x + p.w <= I.PW + 0.5 && p.y + p.h <= I.PH + 0.5, paper + ' rect inside the page'); }
  }
});

test('notebook: versions while writing and on close, restore, images pruned', () => {
  const s = I.encodeStroke({ t: 'p', c: '#000000', w: 16, s: 0, pts: [10, 10, 16, 20, 20, 16] });
  let nb = I.newNotebook({}, T0);
  const add = (n, at) => { const pages = n.pages.slice(); pages[0] = Object.assign({}, pages[0], { ink: pages[0].ink.concat([s]) }); return I.saveNotebook(n, Object.assign({}, n, { pages }), at); };
  nb = add(nb, T0 + MIN); assert.equal(nb.versions.length, 0, 'an empty notebook is not a version');
  nb = add(nb, T0 + 2 * MIN); assert.equal(nb.versions.length, 1);
  nb = add(nb, T0 + 3 * MIN); assert.equal(nb.versions.length, 1, 'at most one version per ten minutes');
  nb = add(nb, T0 + 14 * MIN); assert.equal(nb.versions.length, 2);
  assert.ok(nb.updatedAt > T0 + 13 * MIN);
  const same = I.saveNotebook(nb, Object.assign({}, nb), T0 + 30 * MIN); assert.equal(same.versions.length, 2, 'no change, no version');
  const back = I.restoreVersion(nb, nb.versions[0].at, T0 + 31 * MIN);
  assert.equal(back.pages[0].ink.length, 1); assert.equal(back.versions.length, 3, 'restoring keeps the current pages as a version');
  /* closing: the pages as they were when opened are kept, once */
  const opened = nb, openPages = opened.pages, openAt = opened.updatedAt;
  let later = add(add(opened, T0 + 15 * MIN), T0 + 16 * MIN);
  later = Object.assign({}, later, { versions: opened.versions });
  const closed = I.closeSession(later, openPages, openAt, T0 + 20 * MIN);
  assert.equal(closed.versions.length, 3); assert.equal(closed.versions[2].at, openAt);
  assert.equal(I.closeSession(closed, openPages, openAt, T0 + 21 * MIN), closed, 'not twice');
  assert.equal(I.closeSession(opened, openPages, openAt, T0 + 21 * MIN), opened, 'unchanged: nothing');
  /* images: an image no page or version uses is dropped */
  let pic = I.newNotebook({}, T0); pic = Object.assign({}, pic, { imgs: { a: 'data:image/jpeg;base64,AAAA', b: 'data:image/jpeg;base64,BBBB' } });
  pic.pages = [Object.assign({}, pic.pages[0], { im: [{ id: 'm1', k: 'a', x: 0, y: 0, w: 100, h: 100 }] })];
  assert.deepEqual(Object.keys(I.pruneImgs(pic).imgs), ['a']);
  /* never more than the cap */
  let many = I.newNotebook({}, T0);
  for (let i = 0; i < 20; i++) many = I.saveNotebook(many, Object.assign({}, many, { pages: [Object.assign({}, many.pages[0], { ink: many.pages[0].ink.concat([s]) })] }), T0 + i * 11 * MIN);
  assert.ok(many.versions.length <= I.MAX_VERSIONS);
});

test('notebook from storage or another device: cleaned', () => {
  const s = I.encodeStroke({ t: 'p', c: '#000000', w: 16, s: 0, pts: [10, 10, 16] });
  const raw = { id: 'nb1', kind: 'notebook', title: 'x'.repeat(500), paper: 'evil', updatedAt: 1, createdAt: 1,
    pages: [{ id: 'p1', paper: 'approach', ink: [s, '<script>', 9], tx: [{ id: 't', x: -50, y: 20, w: 5, fs: 9999, s: 'hi', c: 'red' }], im: [{ id: 'm', k: 'img1', x: 0, y: 0, w: 10, h: 10 }, { k: '../x' }] }, 'junk'],
    imgs: { img1: 'data:image/jpeg;base64,QUJD', bad: 'javascript:alert(1)', img2: 'data:text/html;base64,AAAA' }, versions: 'no' };
  const c = I.cleanNotebook(raw);
  assert.equal(c.title.length, 120); assert.equal(c.paper, 'grid'); assert.equal(c.pages.length, 1);
  assert.deepEqual(c.pages[0].ink, [s]); assert.equal(c.pages[0].paper, 'approach');
  assert.deepEqual(c.pages[0].tx[0], { id: 't', x: 0, y: 20, w: 120, fs: 200, c: '#1B2430', s: 'hi' });
  assert.equal(c.pages[0].im.length, 1); assert.deepEqual(Object.keys(c.imgs), ['img1']); assert.deepEqual(c.versions, []);
  assert.equal(I.cleanNotebook({ id: 'x', kind: 'notebook', gone: 1, updatedAt: 1 }).gone, 1, 'tombstones pass through');
  const di = I.cleanDocInk({ id: 'ink:d1', kind: 'ink', doc: 'd1', pages: { 3: [s, 'bad'], x: [s], 4: [] } });
  assert.deepEqual(di.pages, { 3: [s] });
  assert.equal(I.docInkId('d1'), 'ink:d1'); assert.equal(I.newDocInk('d1', T0).kind, 'ink');
});

test('sync merge: concurrent notebook edits keep the other pages as a version; PDF ink keeps pages from both', () => {
  const s1 = I.encodeStroke({ t: 'p', c: '#000000', w: 16, s: 0, pts: [10, 10, 16] }), s2 = I.encodeStroke({ t: 'p', c: '#C0322B', w: 16, s: 0, pts: [90, 90, 16] });
  const base = I.newNotebook({ title: 'Brief' }, T0);
  const a = Object.assign({}, base, { pages: [Object.assign({}, base.pages[0], { ink: [s1] })], updatedAt: T0 + 5 * MIN });
  const b = Object.assign({}, base, { pages: [Object.assign({}, base.pages[0], { ink: [s2] })], updatedAt: T0 + 6 * MIN });
  const r = W.mergeItem(a, b, T0 + MIN);
  assert.ok(r.conflict); assert.deepEqual(r.item.pages[0].ink, [s2]); assert.deepEqual(r.item.versions[0].pages[0].ink, [s1]);
  const again = W.mergeItem(a, r.item, T0 + MIN); assert.equal(again.item.versions.length, 1, 'merging again adds nothing');
  const ia = { id: 'ink:d', kind: 'ink', doc: 'd', pages: { 1: [s1] }, updatedAt: T0 + 5 * MIN }, ib = { id: 'ink:d', kind: 'ink', doc: 'd', pages: { 2: [s2] }, updatedAt: T0 + 6 * MIN };
  assert.deepEqual(W.mergeItem(ia, ib, T0).item.pages, { 1: [s1], 2: [s2] });
});

test('PDF writer: header, objects, xref offsets and trailer are consistent', () => {
  const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 0xFF, 0xD9]);
  const out = I.pdfFromJpegs([{ jpeg, w: 10, h: 14, pw: 595.28, ph: 841.89 }, { jpeg, w: 20, h: 10, pw: 842, ph: 595 }], { title: 'Kneeboard (IR) \\ ø' });
  const txt = Buffer.from(out).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4\n%')); assert.ok(txt.endsWith('%%EOF\n'));
  assert.equal((txt.match(/\/Type \/Page /g) || []).length, 2); assert.match(txt, /\/Count 2/);
  assert.match(txt, /\/Title \(Kneeboard \\\(IR\\\) \\\\ \?\)/, 'title escaped, non-ASCII replaced');
  const startxref = +/startxref\n(\d+)\n%%EOF/.exec(txt)[1];
  assert.ok(txt.slice(startxref).startsWith('xref\n0 10\n'), 'startxref points at the table; 1 + 3 + 2 × 3 objects');
  const rows = txt.slice(startxref).split('\n').slice(3, 12);
  rows.forEach((row, i) => { const off = +row.slice(0, 10); assert.match(row, /^\d{10} 00000 n $/); assert.ok(txt.slice(off).startsWith((i + 1) + ' 0 obj\n'), 'object ' + (i + 1) + ' at ' + off); });
  assert.match(txt, /\/Size 10 \/Root 1 0 R/);
  /* each image stream holds the JPEG bytes and its declared length */
  const m = /\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/.exec(txt); assert.equal(+m[1], jpeg.length);
  const at = m.index + m[0].length; assert.deepEqual([...out.slice(at, at + jpeg.length)], [...jpeg]);
  assert.match(txt, /\/MediaBox \[0 0 842 595\]/);
});
