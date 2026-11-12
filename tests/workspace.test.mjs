/* My Workspace: core logic and the new sync namespaces.  node --test tests/workspace.test.mjs
   The sync tests run the real Functions (functions/_lib/api.js) on the D1 stand-in, with software passkeys. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeD1 } from './lib/d1mock.mjs';
import { SoftAuthenticator } from './lib/softauthn.mjs';
import { endpoint, handlers as H, _test } from '../functions/_lib/api.js';

const W = createRequire(import.meta.url)('../workspacecore.js');
const INK = createRequire(import.meta.url)('../inkcore.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://birdbird.eu';
const T0 = Date.UTC(2026, 10, 10, 9, 0, 0), MIN = 60e3, DAY = 864e5;
const map = (...items) => Object.fromEntries(items.map(i => [i.id, i]));

/* ---------- items, trash, versions ---------- */
test('aircraft: type list has the three trainers, speeds table is editable rows without invented numbers', () => {
  for (const [k, page] of [['c172', 'c172.html'], ['da42', 'cockpit.html'], ['b200', 'b200.html']]) assert.equal(W.typeOf(k).trainer, page);
  const a = W.newAircraft({ typeKey: 'da42', reg: 'ln-abc', callsign: 'Birdie 12' }, T0);
  assert.equal(a.reg, 'LN-ABC'); assert.equal(a.type, 'Diamond DA42');
  assert.ok(a.speeds.some(r => r.k === 'VMCA') && a.speeds.every(r => r.v === ''));
  const free = W.newAircraft({ typeKey: 'other', type: 'Extra 330' }, T0);
  assert.equal(W.aircraftName(free), 'Extra 330');
  assert.equal(W.aircraftName(a), 'Diamond DA42 · LN-ABC');
});

test('trash: 30 days to restore, then a tombstone that still carries the deletion, dropped after 180 days', () => {
  const n = W.newNote({ title: 'Circuit notes', body: 'Flaps 10 abeam' }, T0);
  const t = W.trash(n, T0 + MIN);
  assert.ok(W.inTrash(t) && !W.isLive(t)); assert.equal(W.trashDaysLeft(t, T0 + MIN), 30);
  assert.equal(W.trashDaysLeft(t, T0 + 29.5 * DAY), 1);
  const r = W.restore(t, T0 + 2 * MIN);
  assert.ok(W.isLive(r)); assert.equal(r.body, n.body); assert.ok(r.updatedAt > t.updatedAt);
  let p = W.purgeExpired(map(t), T0 + 29 * DAY);
  assert.equal(p.purged.length, 0); assert.equal(p.items[n.id].body, n.body);
  p = W.purgeExpired(map(t), T0 + 31 * DAY);
  assert.equal(p.purged.length, 1); assert.equal(p.purged[0].id, n.id);
  assert.deepEqual(Object.keys(p.items[n.id]).sort(), ['deletedAt', 'gone', 'id', 'kind', 'updatedAt']);
  assert.equal(W.trashed(p.items).length, 0, 'a tombstone is not shown in Trash');
  assert.ok(p.items[n.id] && W.purgeExpired(p.items, T0 + 100 * DAY).items[n.id], 'tombstone kept');
  assert.equal(W.purgeExpired(p.items, T0 + 31 * DAY + 181 * DAY).items[n.id], undefined, 'tombstone dropped');
});

test('notes: every edit is saved, versions are taken per burst, capped, and can be restored', () => {
  let n = W.newNote({ title: 'ILS brief', body: 'v0' }, T0);
  n = W.editNote(n, { body: 'v1' }, T0 + 1000);
  assert.equal(n.body, 'v1'); assert.equal(n.versions.length, 1); assert.equal(n.versions[0].body, 'v0');
  n = W.editNote(n, { body: 'v1 more' }, T0 + 5000);
  assert.equal(n.versions.length, 1, 'same burst: no new version');
  n = W.editNote(n, { body: 'v2' }, T0 + 5 * MIN);
  assert.equal(n.versions.length, 2); assert.equal(n.versions[1].body, 'v1 more');
  n = W.editNote(n, { body: 'v2 a' }, T0 + 5 * MIN + 1000); n = W.editNote(n, { body: 'v2 ab' }, T0 + 5 * MIN + 2000);
  assert.equal(n.versions.length, 2, 'one version per pause, not one per keystroke after it');
  n = W.editNote(n, { body: 'v2' }, T0 + 5 * MIN + 3000);
  const same = W.editNote(n, { pinned: true }, T0 + 20 * MIN);
  assert.equal(same.versions.length, 2, 'pinning is not a text change');
  let m = n; for (let i = 0; i < 40; i++) m = W.editNote(m, { body: 'edit ' + i }, T0 + (10 + i * 3) * MIN);
  assert.equal(m.versions.length, W.MAX_VERSIONS); assert.equal(m.versions[m.versions.length - 1].body, 'edit 38');
  const at = m.versions[5].at, was = m.versions[5].body;
  const r = W.restoreVersion(m, at, T0 + 999 * MIN);
  assert.equal(r.body, was); assert.equal(r.versions[r.versions.length - 1].body, 'edit 39', 'the text before the restore is kept as a version');
});

test('note text is whitelisted HTML', () => {
  const s = W.sanitizeHtml('<h1>Brief</h1><p onclick="x()">Hi <b style="color:red">there</b><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:1">l</a></p><ul><li>a</li></ul>2 < 3 &amp; 4 > 1');
  assert.equal(s, '<h3>Brief</h3><p>Hi <b>there</b>l</p><ul><li>a</li></ul>2 &lt; 3 &amp; 4 &gt; 1');
  assert.ok(!/on\w+=|script|javascript|<img|<a/i.test(s));
  assert.equal(W.sanitizeHtml('<scr<script>ipt>alert(1)</scr</script>ipt>').includes('<script'), false);
  assert.equal(W.htmlToText('<div>Line one</div><div>2 &lt; 3 &amp; ok</div><ul><li>x</li></ul>'), 'Line one\n2 < 3 & ok\nx');
  assert.equal(W.newNote({ body: '<b>x</b><iframe src=//evil></iframe>' }, T0).body, '<b>x</b>');
});

/* ---------- merge ---------- */
test('merge: newest wins per item, nothing is dropped, absence is not a deletion', () => {
  const a = W.newAircraft({ typeKey: 'c172', reg: 'LN-AAA' }, T0), n = W.newNote({ title: 'A', body: 'local only' }, T0), r = W.newNote({ title: 'B', body: 'remote only' }, T0);
  const a2 = W.patch(a, { callsign: 'Sola 1' }, T0 + MIN);
  const m = W.mergeItems(map(a, n), map(a2, r), T0 + 10 * MIN);
  assert.deepEqual(Object.keys(m.items).sort(), [a.id, n.id, r.id].sort());
  assert.equal(m.items[a.id].callsign, 'Sola 1');
  assert.ok(m.changedLocal && m.changedRemote); assert.equal(m.conflicts.length, 0);
  const again = W.mergeItems(m.items, m.items, T0);
  assert.ok(!again.changedLocal && !again.changedRemote);
});

test('merge: a concurrent edit of the same note keeps the other text as a version (never silently dropped)', () => {
  const base = T0 + MIN;
  const n = W.newNote({ title: 'Engine failure after take-off', body: 'original' }, T0);
  const phone = W.editNote(n, { body: 'edited on the phone', tags: ['b200'] }, T0 + 5 * MIN);
  const ipad = W.editNote(n, { body: 'edited on the iPad', tags: ['oei'] }, T0 + 6 * MIN);
  const m = W.mergeItems(map(phone), map(ipad), base);
  const got = m.items[n.id];
  assert.equal(got.body, 'edited on the iPad');
  assert.deepEqual(m.conflicts, [n.id]);
  const kept = got.versions.find(v => v.conflict);
  assert.equal(kept.body, 'edited on the phone');
  assert.ok(got.versions.some(v => v.body === 'original'));
  assert.deepEqual(got.tags.sort(), ['b200', 'oei']);
  const back = W.mergeItems(map(ipad), map(phone), base).items[n.id];
  assert.equal(W.stable(back), W.stable(got), 'both devices end with the same note');
  /* not concurrent: the older side was already synced before the newer edit */
  const calm = W.mergeItems(map(n), map(ipad), T0 + MIN);
  assert.equal(calm.conflicts.length, 0); assert.equal(calm.items[n.id].body, 'edited on the iPad');
});

test('merge: deleting on one device moves the item to Trash on the other; a later edit elsewhere wins over an older delete', () => {
  const n = W.newNote({ title: 'x', body: 'keep me' }, T0);
  const del = W.trash(n, T0 + 2 * MIN);
  let m = W.mergeItems(map(n), map(del), T0 + MIN);
  assert.ok(W.inTrash(m.items[n.id])); assert.equal(m.items[n.id].body, 'keep me', 'restorable for 30 days');
  const edited = W.editNote(n, { body: 'edited later' }, T0 + 9 * MIN);
  m = W.mergeItems(map(del), map(edited), T0 + MIN);
  assert.ok(W.isLive(m.items[n.id])); assert.equal(m.items[n.id].body, 'edited later');
  const gone = W.tombstone(del, T0 + 40 * DAY);
  m = W.mergeItems(map(n), map(gone), 0);
  assert.equal(m.items[n.id].gone, 1);
});

test('merge: document index entries union their tags and aircraft links; aircraft keep filled-in speeds', () => {
  const d = W.newDocEntry({ id: 'fd1', name: 'DA42 AFM', cat: 'afm' }, T0);
  const x = W.patch(d, { tags: ['rev9'], acIds: ['ac1'] }, T0 + 2 * MIN), y = W.patch(d, { tags: ['g1000'], acIds: ['ac2'], name: 'DA42 NG AFM' }, T0 + 3 * MIN);
  const got = W.mergeItems(map(x), map(y), T0).items.fd1;
  assert.equal(got.name, 'DA42 NG AFM'); assert.deepEqual(got.tags.sort(), ['g1000', 'rev9']); assert.deepEqual(got.acIds.sort(), ['ac1', 'ac2']);
  const a = W.newAircraft({ typeKey: 'c172' }, T0);
  const s1 = W.patch(a, { speeds: a.speeds.map(r => r.k === 'VR' ? { ...r, v: '55' } : r) }, T0 + 2 * MIN);
  const s2 = W.patch(a, { speeds: a.speeds.map(r => r.k === 'VY' ? { ...r, v: '74' } : r), notes: 'tailwheel no' }, T0 + 3 * MIN);
  const ac = W.mergeItems(map(s1), map(s2), T0).items[a.id];
  assert.equal(ac.speeds.find(r => r.k === 'VR').v, '55'); assert.equal(ac.speeds.find(r => r.k === 'VY').v, '74'); assert.equal(ac.notes, 'tailwheel no');
});

/* ---------- search ---------- */
test('search: all words must match, titles and tags rank first, Norwegian letters and prefixes work', () => {
  const idx = W.buildIndex([
    { t: 'note', id: 'n1', title: 'Engine failure after take-off', text: 'Mixture, props, throttles. Identify, verify, feather.', tags: ['oei'], at: 1 },
    { t: 'doc', id: 'd1', title: 'DA42 NG AFM', sub: 'AFM / POH', text: '', tags: ['rev9'], at: 2 },
    { t: 'aircraft', id: 'a1', title: 'Diamond DA42 · LN-ABC', text: 'engine notes: left engine runs hot', tags: [], at: 3 },
    { t: 'note', id: 'n2', title: 'Værbriefing Tromsø', text: 'Sjøtåke om morgenen', tags: ['vær'], at: 4 },
    { t: 'pack', id: 'p1', title: 'ENTO – ENBR', sub: '2026-11-12 DA42 LN-ABC IFR', text: '', at: 5 }
  ]);
  const ids = q => W.search(idx, q).map(r => r.entry.id);
  assert.deepEqual(ids('engine'), ['n1', 'a1']);
  assert.deepEqual(ids('engine feather'), ['n1']);
  assert.deepEqual(ids('da42').sort(), ['a1', 'd1', 'p1']);
  assert.deepEqual(ids('ln-abc').sort(), ['a1', 'p1']);
  assert.deepEqual(ids('vaer'), [], 'no false folding of æ'); assert.deepEqual(ids('vær'), ['n2']); assert.deepEqual(ids('TROMSØ sjø'), ['n2']);
  assert.deepEqual(ids('oei'), ['n1']); assert.deepEqual(ids('rev'), ['d1']);
  assert.deepEqual(ids('nothinghere'), []); assert.deepEqual(ids('  '), []);
  assert.match(W.search(idx, 'feather')[0].snippet, /feather/);
  const chunks = []; W.chunkPage('Limitations. Maximum demonstrated crosswind 25 kt. ' + 'x '.repeat(900), 7, chunks, 'SECTION 2 LIMITATIONS');
  const hit = W.searchChunks(chunks, 'crosswind demonstrated');
  assert.equal(hit.p, 7); assert.match(hit.snippet, /crosswind/);
  assert.equal(W.searchChunks(chunks, 'crosswind tailwheel'), null);
});

test('document text: chunking matches Flight Intelligence and reads back as pages', () => {
  const text = Array.from({ length: 400 }, (_, i) => 'word' + i).join(' ');
  const chunks = []; W.chunkPage(text, 3, chunks, 'S');
  assert.ok(chunks.length > 1 && chunks.every(c => c.t.length <= 1400 && c.p === 3));
  assert.equal(W.pagesFromChunks(chunks)[0].t, text);
  const c2 = []; const pages = W.byParts(('para '.repeat(200) + '\n\n').repeat(8), c2);
  assert.ok(pages >= 2 && c2.length >= pages);
  assert.equal(W.guessKind('DA42 QRH emergency.pdf'), 'qrh'); assert.equal(W.kindToCat('qrh'), 'chk'); assert.equal(W.guessCat('Company SOP v3.pdf'), 'sop'); assert.equal(W.guessCat('ENTO ILS 18 chart.pdf'), 'charts');
  assert.equal(W.catToKind('company'), 'ref');
});

/* ---------- quota ---------- */
test('quota: a namespace that is too big is gzipped, then loses old versions in the synced copy, then leaves the largest notes on the device', async () => {
  const rnd = n => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2) + ' '; return s.slice(0, n); };
  const small = map(W.newNote({ title: 'a', body: 'b' }, T0));
  let p = await W.packNs(small, 100000);
  assert.ok(!p.gz && !p.full && p.trimmedVersions === 0); assert.ok(p.data.items);
  /* compressible text: fits once gzipped, nothing trimmed */
  const wordy = map(...Array.from({ length: 6 }, (_, i) => W.newNote({ title: 'n' + i, body: 'the quick brown fox '.repeat(3000) }, T0)));
  p = await W.packNs(wordy, 100000);
  assert.ok(p.gz && p.bytes <= 100000 && p.trimmedVersions === 0 && !p.full);
  assert.equal(W.stable(await W.unpackNs(p.data)), W.stable(wordy));
  /* incompressible history: versions go first, the notes themselves stay */
  let n = W.newNote({ title: 'big history', body: rnd(3000) }, T0);
  for (let i = 0; i < 20; i++) n = W.editNote(n, { body: rnd(3000) }, T0 + (i + 1) * 5 * MIN);
  assert.equal(n.versions.length, 20);
  p = await W.packNs(map(n), 20000);
  assert.ok(p.bytes <= 20000 && p.trimmedVersions > 0 && !p.full);
  const back = await W.unpackNs(p.data);
  assert.equal(back[n.id].body, n.body); assert.ok(back[n.id].versions.length < 20);
  assert.equal(n.versions.length, 20, 'the device copy is untouched');
  /* still too big: the largest note is left on the device and reported */
  const huge = W.newNote({ title: 'huge', body: rnd(60000) }, T0), ok = W.newNote({ title: 'ok', body: rnd(2000) }, T0);
  p = await W.packNs(map(huge, ok), 20000);
  assert.ok(p.full); assert.deepEqual(p.leftOut, [huge.id]); assert.ok(p.bytes <= 20000);
  assert.deepEqual(Object.keys(await W.unpackNs(p.data)), [ok.id]);
  /* merging the trimmed account copy back never removes versions or the left-out note from the device */
  const m = W.mergeItems(map(huge, ok, n), Object.assign({}, await W.unpackNs(p.data), back), T0);
  assert.equal(m.items[huge.id].body, huge.body); assert.equal(m.items[n.id].versions.length, 20);
  assert.equal(W.fmtBytes(1536), '1.5 kB'); assert.equal(W.fmtBytes(5 * 1048576), '5.0 MB');
});

/* ---------- backup ---------- */
test('zip: stored archive round-trips, detects damage, rejects other files', async () => {
  const z = new W.ZipWriter(T0); const bin = new Uint8Array(70000).map((_, i) => (i * 31) & 255);
  z.add('a.txt', 'hei på deg'); z.add('dir/b.bin', bin);
  const u = z.bytes();
  assert.equal(u[0], 0x50); assert.equal(u[1], 0x4b);
  const es = await W.zipRead(u);
  assert.deepEqual(es.map(e => e.name), ['a.txt', 'dir/b.bin']);
  assert.equal(new TextDecoder().decode(await es[0].read()), 'hei på deg');
  assert.deepEqual(await es[1].read(), bin);
  assert.equal(W.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const bad = u.slice(); bad[40] ^= 255;   // a byte of a.txt's data
  await assert.rejects(async () => { for (const e of await W.zipRead(bad)) await e.read(); }, e => e.code === 'bad_crc');
  await assert.rejects(W.zipRead(new TextEncoder().encode('{"not":"a zip, just some json that is long enough"}')), e => e.code === 'bad_zip');
  /* a Blob source (as in the browser) gives the same entries, and stored files come back as slices without copying */
  const viaBlob = await W.zipRead(new Blob([u]));
  assert.deepEqual(await viaBlob[1].read(), bin);
  assert.deepEqual(new Uint8Array(await (await viaBlob[1].slice('application/octet-stream')).arrayBuffer()), bin);
});

test('backup: export, wipe, import brings everything back (items, versions, trash, packs, routes, documents with their files)', async () => {
  const ac = W.newAircraft({ typeKey: 'b200', reg: 'LN-KAB', notes: 'Raisbeck' }, T0);
  let note = W.newNote({ title: 'Kneeboard', body: '<b>Brief</b> first', tags: ['ifr'], links: [{ t: 'aircraft', id: ac.id }, { t: 'doc', id: 'fd1' }] }, T0);
  note = W.editNote(note, { body: '<b>Brief</b> second' }, T0 + 3 * MIN);
  const binned = W.trash(W.newNote({ title: 'old', body: 'x' }, T0), T0 + MIN);
  const entry = W.newDocEntry({ id: 'fd1', name: 'B200 POH', cat: 'afm', acIds: [ac.id], tags: ['rev 4'], pages: 2, size: 5000, ext: 'pdf' }, T0);
  const items = map(ac, note, binned, entry, W.newPackMark('p1', { pinned: true, acId: ac.id }, T0));
  const pdf = new Uint8Array(5000).map((_, i) => (i * 7 + 3) & 255); pdf.set([0x25, 0x50, 0x44, 0x46]);
  const chunks = []; W.chunkPage('Section 2 limitations. VMCA 86 KIAS.', 1, chunks, ''); W.chunkPage('Section 3 emergency procedures.', 2, chunks, '');
  const local = { 'naeroson-store-prep': JSON.stringify({ p1: { id: 'p1', title: 'ENTO – ENBR', updated: T0, f: { reg: 'LN-KAB' } } }), 'naeroson-store-route': JSON.stringify({ r1: { id: 'r1', pts: [{ t: 'rwy', n: 'ENTO' }], updated: T0 } }) };
  const docs = [{ doc: { id: 'fd1', ac: 'gen', name: 'B200 POH', kind: 'afm', pages: 2, chunks, added: T0, blob: true }, file: pdf, fileName: 'B200 POH.pdf', fileType: 'application/pdf' },
    { doc: { id: 'fd2', ac: 'gen', name: 'Company SOP', kind: 'sop', pages: 1, chunks: [{ p: 1, t: 'Stabilised by 1000 ft.', s: '' }], added: T0, blob: false }, file: null }];
  docs[0].load = async () => ({ u8: pdf, keep: null }); delete docs[0].file;   // the browser loads one file at a time
  const bytes = (await W.buildBackup({ items, local, docs }, T0 + DAY)).bytes();

  const b = await W.readBackup(bytes);            // on a wiped device
  assert.equal(b.exportedAt, T0 + DAY);
  assert.equal(W.stable(b.items), W.stable(items));
  assert.deepEqual(b.local, local);
  assert.equal(b.docs.length, 2);
  assert.deepEqual(b.docs[0].doc.chunks, chunks); assert.equal(b.docs[0].doc.name, 'B200 POH'); assert.equal(b.docs[0].fileName, 'B200 POH.pdf'); assert.equal(b.docs[0].fileType, 'application/pdf');
  assert.deepEqual(await b.docs[0].read(), pdf);
  assert.equal(await b.docs[1].read(), null);
  const restored = W.mergeItems({}, b.items, 0).items;
  assert.equal(restored[note.id].versions.length, 1); assert.ok(W.inTrash(restored[binned.id])); assert.equal(restored['pk:p1'].pinned, true);

  /* importing over newer local data keeps the newer copy and adds what is missing */
  const newer = W.editNote(note, { body: 'newer on this device' }, T0 + 2 * DAY), extra = W.newNote({ title: 'made after the backup' }, T0 + 2 * DAY);
  const m = W.mergeItems(map(newer, extra), b.items, 0).items;
  assert.equal(m[note.id].body, 'newer on this device'); assert.ok(m[extra.id] && m[ac.id]);
  assert.ok(m[note.id].versions.some(v => v.body === '<b>Brief</b> second'), 'the backup text is kept as a version');
  assert.equal(W.mergeLocalKey('naeroson-store-prep', JSON.stringify({ p1: { id: 'p1', title: 'newer', updated: T0 + 5 }, p9: { id: 'p9', updated: 1 } }), local['naeroson-store-prep']), JSON.stringify({ p1: { id: 'p1', title: 'newer', updated: T0 + 5 }, p9: { id: 'p9', updated: 1 } }));
  assert.equal(W.mergeLocalKey('naeroson-prog', '{"a":1}', '{"a":9}'), '{"a":1}'); assert.equal(W.mergeLocalKey('naeroson-prog', null, '{"a":9}'), '{"a":9}');

  /* hostile or wrong files */
  await assert.rejects(W.readBackup(new TextEncoder().encode('x'.repeat(100))), e => e.code === 'bad_backup');
  const z = new W.ZipWriter(T0); z.add('birdbird-backup.json', JSON.stringify({ format: W.BACKUP_FORMAT, v: 1, items: { n9: { id: 'n9', kind: 'note', updatedAt: 5, title: 't', body: '<img src=x onerror=alert(1)>hi', versions: [{ at: 1, title: '', body: '<script>1</script>v' }] }, bad: { id: 'other', kind: 'note', updatedAt: 1 } }, documents: [{ meta: {} }] }));
  const evil = await W.readBackup(z.bytes());
  assert.equal(evil.items.n9.body, 'hi'); assert.equal(evil.items.n9.versions[0].body, 'v'); assert.equal(evil.items.bad, undefined); assert.equal(evil.docs.length, 0);
});

test('recent list: newest first, no duplicates, capped', () => {
  let r = []; for (let i = 0; i < 15; i++) r = W.pushRecent(r, { t: 'note', id: 'n' + i, at: i });
  r = W.pushRecent(r, { t: 'note', id: 'n10', at: 99 });
  assert.equal(r.length, 12); assert.equal(r[0].id, 'n10'); assert.equal(r.filter(x => x.id === 'n10').length, 1);
});

/* ---------- the new namespaces on the real API ---------- */
function world() {
  const clock = { t: T0 };
  const env = { DB: makeD1(join(ROOT, 'migrations')) };
  const deps = { now: () => clock.t, random: () => 0.99 };
  const ROUTES = { '/api/auth/register/options': { POST: H.registerOptions }, '/api/auth/register/verify': { POST: H.registerVerify }, '/api/me': { GET: H.meGet }, '/api/sync': { GET: H.syncGet, PUT: H.syncPut } };
  function browser(ip) {
    const jar = {};
    async function call(method, path, body) {
      const url = new URL(path, ORIGIN);
      const h = new Headers({ 'user-agent': 'Mozilla/5.0 (iPad) Safari', 'cf-connecting-ip': ip || '203.0.113.7' });
      if (method !== 'GET') h.set('origin', ORIGIN);
      if (body !== undefined) h.set('content-type', 'application/json');
      const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.set('cookie', ck);
      const res = await endpoint(ROUTES[url.pathname], deps)({ request: new Request(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, waitUntil: () => {} });
      for (const line of res.headers.getSetCookie()) { const [kv] = line.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      return { status: res.status, body: await res.json() };
    }
    /* the transport workspace.js uses */
    const put = async body => { const r = await call('PUT', '/api/sync', body); return r.status === 200 ? r.body : { ok: false, error: r.body.error, current: r.body.current }; };
    const get = async ns => { const r = await call('GET', '/api/sync'); assert.equal(r.status, 200); return r.body.ns[ns]; };
    return { jar, call, put, get };
  }
  async function signup(br) { const a = new SoftAuthenticator(); const o = await br.call('POST', '/api/auth/register/options', { name: 'T' }); const v = await br.call('POST', '/api/auth/register/verify', { credential: await a.create(o.body.options, ORIGIN) }); assert.equal(v.status, 200, JSON.stringify(v.body)); }
  return { clock, browser, signup };
}

test('api: workspace and notes are accepted namespaces with the same version check and size limit', async () => {
  assert.ok(_test.NAMESPACES.includes('workspace') && _test.NAMESPACES.includes('notes'));
  assert.deepEqual(_test.NAMESPACES.slice(0, 4), ['progress', 'packs', 'routes', 'settings'], 'the existing namespaces are unchanged');
  const w = world(), br = w.browser(); await w.signup(br);
  const data = { v: 1, items: { ac1: W.newAircraft({ id: 'ac1', typeKey: 'c172' }, T0) } };
  const p1 = await br.call('PUT', '/api/sync', { ns: 'workspace', data, baseVersion: 0, updatedAt: T0 });
  assert.equal(p1.status, 200); assert.equal(p1.body.version, 1);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'notes', data: { v: 1, items: {} }, baseVersion: 0 })).status, 200);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'workspace', data, baseVersion: 0 })).status, 409);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'notes', data: { v: 1, items: { x: 'y'.repeat(1500001) } }, baseVersion: 1 })).status, 413);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'documents', data: {} })).body.error, 'bad_ns');
  const all = (await br.call('GET', '/api/sync')).body.ns;
  assert.deepEqual(Object.keys(all).sort(), ['notes', 'workspace']); assert.deepEqual(all.workspace.data, data);
  const me = await br.call('GET', '/api/me');
  assert.deepEqual(me.body.data.map(x => x.ns).sort(), ['notes', 'workspace']);
  const other = w.browser('198.51.100.9'); await w.signup(other);
  assert.deepEqual((await other.call('GET', '/api/sync')).body.ns, {});
});

test('sync: two devices on one account converge through the real API; a concurrent note edit survives as a version', async () => {
  const w = world(), br = w.browser(); await w.signup(br);
  /* device A */
  const ac = W.newAircraft({ typeKey: 'da42', reg: 'LN-ABC' }, T0), note = W.newNote({ title: 'Brief', body: 'first' }, T0);
  const book = INK.newNotebook({ title: 'Kneeboard', paper: 'kneeboard' }, T0);
  let A = { workspace: map(ac), notes: map(note), ink: map(book) }, vA = {};
  for (const ns of W.NAMESPACES) { const r = await W.syncNs(ns, A[ns], await br.get(ns), br.put, { now: () => w.clock.t }); assert.ok(r.pushed && !r.error && !r.pulled); vA[ns] = r.version; }
  /* device B starts empty and pulls */
  let B = { workspace: {}, notes: {}, ink: {} };
  for (const ns of W.NAMESPACES) { const r = await W.syncNs(ns, B[ns], await br.get(ns), br.put, { now: () => w.clock.t }); assert.ok(!r.pushed && r.pulled); B[ns] = r.items; }
  assert.equal(W.stable(B), W.stable(A));
  const baseA = w.clock.t, baseB = w.clock.t;
  /* both edit the same note; B also adds a note and bins the aircraft */
  w.clock.t += 5 * MIN; A.notes[note.id] = W.editNote(A.notes[note.id], { body: 'from A' }, w.clock.t);
  w.clock.t += MIN; B.notes[note.id] = W.editNote(B.notes[note.id], { body: 'from B' }, w.clock.t);
  const nb = W.newNote({ title: 'only on B', body: 'x' }, w.clock.t); B.notes[nb.id] = nb; B.workspace[ac.id] = W.trash(B.workspace[ac.id], w.clock.t);
  /* B syncs first; A pushes with a stale version through the 409 path */
  for (const ns of W.NAMESPACES) { const r = await W.syncNs(ns, B[ns], await br.get(ns), br.put, { base: baseB, now: () => w.clock.t }); assert.ok((r.pushed || ns === 'ink') && !r.error); B[ns] = r.items; }
  const stale = { data: await W.packNs(map(note)).then(p => p.data), version: vA.notes };
  const rA = await W.syncNs('notes', A.notes, stale, br.put, { base: baseA, now: () => w.clock.t });
  assert.ok(rA.pushed && !rA.error && rA.pulled); assert.deepEqual(rA.conflicts, [note.id]);
  A.notes = rA.items;
  assert.equal(A.notes[note.id].body, 'from B'); assert.ok(A.notes[note.id].versions.some(v => v.conflict && v.body === 'from A')); assert.ok(A.notes[nb.id]);
  const rw = await W.syncNs('workspace', A.workspace, await br.get('workspace'), br.put, { base: baseA, now: () => w.clock.t });
  assert.ok(W.inTrash(rw.items[ac.id]) && !rw.pushed); A.workspace = rw.items;
  /* B picks up A's merge: both hold the same data, and a further sync changes nothing */
  const rB = await W.syncNs('notes', B.notes, await br.get('notes'), br.put, { base: w.clock.t, now: () => w.clock.t }); B.notes = rB.items;
  assert.equal(W.stable(B), W.stable(A));
  const idle = await W.syncNs('notes', A.notes, await br.get('notes'), br.put, { now: () => w.clock.t });
  assert.ok(!idle.pushed && !idle.pulled && !idle.error);
});

test('sync: a full namespace is trimmed for the account, reported, and the device keeps everything', async () => {
  const w = world(), br = w.browser(); await w.signup(br);
  const rnd = n => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2) + ' '; return s.slice(0, n); };
  const notes = map(...Array.from({ length: 5 }, (_, i) => W.newNote({ title: 'n' + i, body: rnd(700000) }, T0 + i)));
  const r = await W.syncNs('notes', notes, await br.get('notes'), br.put, { now: () => w.clock.t });
  assert.ok(r.pushed && !r.error, r.error); assert.ok(r.leftOut.length >= 1 && r.leftOut.length < 5);
  assert.equal(Object.keys(r.items).length, 5, 'nothing removed locally');
  const stored = await br.get('notes');
  assert.ok(JSON.stringify(stored.data).length <= 1500000);
  assert.equal(Object.keys(await W.unpackNs(stored.data)).length, 5 - r.leftOut.length);
  const again = await W.syncNs('notes', r.items, stored, br.put, { now: () => w.clock.t });
  assert.ok(!again.pushed && !again.pulled && again.leftOut.length === r.leftOut.length, 'stable: no push loop while full');
});

test('sync: an unreadable account copy is not overwritten and local data is kept', async () => {
  const local = map(W.newNote({ title: 'mine', body: 'x' }, T0)); let puts = 0;
  const r = await W.syncNs('notes', local, { data: { v: 1, z: 'gzip', d: '!!!!' }, version: 3 }, async () => { puts++; return { ok: true, version: 4 }; });
  assert.equal(r.error, 'unreadable'); assert.equal(puts, 0); assert.equal(W.stable(r.items), W.stable(local));
});

test('a note without a title is named by its first line; line breaks survive as text', () => {
  assert.equal(W.noteAutoTitle({ title: ' My title ', body: '<div>x</div>' }), 'My title');
  assert.equal(W.noteAutoTitle({ title: '', body: 'Stall speed clean 52 KIAS<div>Remember carb heat.</div>' }), 'Stall speed clean 52 KIAS');
  assert.equal(W.noteAutoTitle({ title: '', body: '<div><br></div><div>  Second   line </div>' }), 'Second line');
  assert.equal(W.noteAutoTitle({ title: '', body: '' }), '');
  const long = W.noteAutoTitle({ title: '', body: '<div>' + 'word '.repeat(40) + '</div>' });
  assert.ok(long.length <= 60 && long.endsWith('…'));
  assert.equal(W.htmlToText('one<div>two</div><div>three</div>'), 'one\ntwo\nthree');
  assert.equal(W.htmlToText('<div>a</div><div>b</div>'), 'a\nb');
  assert.equal(W.htmlToText('x<ul><li>a</li><li>b</li></ul>'), 'x\na\nb');
});
