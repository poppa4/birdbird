/* localdata.js (BBLOCAL): every Birdbird key and database on the device is listed, exported and deleted.
   The first test reads the site's code, so a new storage key or IndexedDB database that localdata.js does not cover fails here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const plain = x => JSON.parse(JSON.stringify(x));   // objects made inside the vm have other prototypes
const SRC = fs.readFileSync(path.join(ROOT, 'localdata.js'), 'utf8');

class MemStorage {
  constructor(o) { this.m = new Map(Object.entries(o || {})); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(k); }
  keys() { return [...this.m.keys()].sort(); }
}
function load(extra) {
  const G = Object.assign({ Blob, ArrayBuffer, Map, Set, Date, Promise, Event: class { constructor(t) { this.type = t; } }, document: { dispatchEvent() {} } }, extra || {});
  G.window = G; vm.createContext(G); vm.runInContext(SRC, G); return G;
}

/* ---- the code's own storage keys and databases ---- */
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && !/^(three\.min|localdata)\.js$/.test(f));
function storageNames() {
  const keys = new Set(), dbs = new Set();
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const resolve = x => {
      x = x.trim();
      let m = /^['"`]([^'"`$]+)/.exec(x); if (m) return m[1];                 // literal, or the literal start of 'pfx-'+id / `pfx-${id}`
      m = /^([A-Za-z_$][\w$]*)(?:\.([\w$]+))?/.exec(x); if (!m) return null;
      const re = m[2] ? new RegExp('\\b' + m[2] + "\\s*:\\s*['\"`]([^'\"`$]+)") : new RegExp('(?:\\b(?:const|let|var)|,)\\s*' + m[1] + "\\s*=\\s*['\"`]([^'\"`$]+)");
      const d = re.exec(s); return d ? d[1] : null;                           // parameters (k, key) resolve to nothing
    };
    for (const m of s.matchAll(/\b(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)) { const k = resolve(m[1]); if (k && k !== 'x') keys.add(k); }
    // small wrappers of this file such as  const load=k=>{ … localStorage.getItem(k) … }  or  function lsGet(k,d){ … }
    const wrappers = [...s.matchAll(/(?:const|let|function)\s+([A-Za-z_$][\w$]*)\s*=?\s*(?:function\s*)?\(?\s*k\b[^\n]{0,120}?(?:localStorage|sessionStorage|LS|ls)\.(?:getItem|setItem|removeItem)\(k\b/g)].map(m => m[1]);
    if (wrappers.length) for (const m of s.matchAll(new RegExp('\\b(?:' + wrappers.join('|') + ")\\(\\s*(['\"`][^'\"`]+['\"`]|[A-Z][\\w.]*)", 'g'))) { const k = resolve(m[1]); if (k) keys.add(k); }
    for (const m of s.matchAll(/\b(?:indexedDB\.open|openIdb|idb)\(\s*([^,)]+)/g)) { const n = resolve(m[1]); if (n) dbs.add(n); }
  }
  return { keys, dbs };
}

test('every storage key and IndexedDB database in the code is covered', () => {
  const G = load();
  const { keys, dbs } = storageNames();
  assert.ok(keys.size > 30, 'the scan sees the site (' + keys.size + ')');
  for (const k of ['bb-ai-api', 'bb-ai-off', 'bb-map-weak', 'fi-view', 'birdbird-account', 'birdbird-navsim-snap', 'naeroson-store-', 'aeroson-fpl', 'vlab-lang', 'bb-ws-items', 'bb-ws-kv', 'bb-ifr-builder', 'naeroson-radio-prefs', 'bb-ownck-text']) assert.ok(keys.has(k), 'scan finds ' + k);
  const missed = [...keys].filter(k => !G.BBLOCAL.ours(k));
  assert.deepEqual(missed, [], 'keys not covered by BBLOCAL.PREFIXES');
  assert.deepEqual([...dbs].filter(n => !G.BBLOCAL.DBS.includes(n)), [], 'databases not in BBLOCAL.DBS');
  for (const n of ['birdbird-workspace', 'naeroson-fi', 'naeroson-docs', 'naeroson-att']) assert.ok(dbs.has(n) || n === 'naeroson-docs' ? G.BBLOCAL.DBS.includes(n) : false, n);
  assert.ok(dbs.has('birdbird-workspace') && dbs.has('naeroson-fi') && dbs.has('naeroson-att') && dbs.has('naeroson-docs'));
});

function fakeIdb(existing) {
  const deleted = [];
  return { deleted, databases: async () => existing.map(name => ({ name, version: 1 })),
    deleteDatabase(n) { deleted.push(n); const q = {}; setTimeout(() => q.onsuccess && q.onsuccess(), 0); return q; } };
}
const SEED = { 'bb-track': 'ppl', 'bb-ws-items': '{}', 'bb-openaip-key': 'k', 'naeroson-prog': '{"a":1}', 'naeroson-store-prep': '{}', 'aeroson-quiz-holding': '80', 'aeroson-fpl': '{}',
  'vlab-done-forces': '1', 'vlab-lang': 'no', 'fi-imp-ck': '1', 'birdbird-account': '{"signedIn":false}', 'birdbird-navsim-snap': '{}', 'birdbird-navsim-panel-x': '1',
  'other-site': 'keep me', 'theme': 'dark' };

test('clearAll removes every Birdbird key, session key and database, and nothing else', async () => {
  const ls = new MemStorage(SEED), ss = new MemStorage({ 'fi-view': 'docs', 'bb-ai-api': '1', 'bb-ai-off': '1', 'bb-map-weak': 'lost', 'unrelated': 'x' });
  const idb = fakeIdb(['birdbird-workspace', 'naeroson-fi', 'naeroson-att']);
  const G = load({ localStorage: ls, sessionStorage: ss, indexedDB: idb });
  const inv = await G.BBLOCAL.inventory();
  assert.equal(inv.local.length, Object.keys(SEED).length - 2);
  assert.deepEqual(plain(inv.session), ['bb-ai-api', 'bb-ai-off', 'bb-map-weak', 'fi-view']);
  assert.deepEqual(plain(inv.dbs), ['birdbird-workspace', 'naeroson-fi', 'naeroson-att']);
  const r = await G.BBLOCAL.clearAll();
  assert.deepEqual(ls.keys(), ['other-site', 'theme', 'vlab-lang'], 'language choice kept by default');
  assert.equal(ls.getItem('vlab-lang'), 'no');
  assert.deepEqual(ss.keys(), ['unrelated']);
  assert.deepEqual([...idb.deleted].sort(), ['birdbird-workspace', 'naeroson-att', 'naeroson-docs', 'naeroson-fi']);
  assert.equal(r.local, Object.keys(SEED).length - 3); assert.equal(r.session, 4);
  await G.BBLOCAL.clearAll({ keepLang: false });
  assert.deepEqual(ls.keys(), ['other-site', 'theme']);
});

test('clearAll goes through account.js so the removal is not synced as a deletion', async () => {
  const ls = new MemStorage(SEED), calls = [];
  const G = load({ localStorage: ls, sessionStorage: new MemStorage(), indexedDB: fakeIdb([]) });
  G.BBACCOUNT = { wipeLocal(pick) { calls.push(pick); for (const k of ls.keys()) if (pick(k)) ls.removeItem(k); } };
  await G.BBLOCAL.clearAll();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]('birdbird-account'), true); assert.equal(calls[0]('vlab-lang'), false); assert.equal(calls[0]('theme'), false);
  assert.deepEqual(ls.keys(), ['other-site', 'theme', 'vlab-lang']);
});

test('account.js wipeLocal(match) removes the chosen keys without noting changes, and forgets the account link', () => {
  const src = fs.readFileSync(path.join(ROOT, 'account.js'), 'utf8');
  assert.match(src, /function wipeLocal\(match\)/);
  assert.match(src, /applying\+\+; try \{ lsKeys\(\)\.filter\(k => pick\(k\)\)\.forEach\(k => rawRem\.call\(LS, k\)\)/);
});

test('export: storage values as they are, files and binary data described but not included', async () => {
  const G = load({ localStorage: new MemStorage(SEED), sessionStorage: new MemStorage({ 'fi-view': 'docs' }), indexedDB: fakeIdb([]) });
  const out = await G.BBLOCAL.exportLocal();
  assert.equal(out.keys['naeroson-prog'], '{"a":1}');
  assert.ok(!('other-site' in out.keys));
  assert.deepEqual(plain(out.sessionStorage), { 'fi-view': 'docs' });
  const doc = G.BBLOCAL.ser({ id: 'd1', name: 'AFM.pdf', chunks: [{ text: 'Vne 188 kt' }], blob: new Blob(['%PDF-1.7 ...'], { type: 'application/pdf' }), raw: new Uint8Array(9), when: new Date(0) });
  assert.deepEqual(plain(doc.blob), { $file: 'not included', type: 'application/pdf', bytes: 12 });
  assert.deepEqual(plain(doc.raw), { $binary: 'not included', bytes: 9 });
  assert.equal(doc.chunks[0].text, 'Vne 188 kt', 'extracted text is kept');
  assert.equal(doc.when, '1970-01-01T00:00:00.000Z');
  assert.doesNotThrow(() => JSON.stringify(doc));
});

test('pages use the shared module: privacy clear tool and My page', () => {
  const pv = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8'), pr = fs.readFileSync(path.join(ROOT, 'profile.html'), 'utf8');
  assert.match(pv, /<script src="localdata\.js\?v=\d+"><\/script>/); assert.match(pv, /BBLOCAL\.clearAll\(/);
  assert.ok(!/const DBS=\[/.test(pv), 'no second list of databases in privacy.html');
  assert.match(pr, /<script src="localdata\.js\?v=\d+"><\/script>/); assert.match(pr, /BBLOCAL\.clearAll\(/); assert.match(pr, /BBLOCAL\.exportLocal\(/);
  assert.match(pr, /\/api\/me\/export/);
  assert.match(pr, /el\('acDelLocal'\)\.checked=true/, 'account deletion: clear this device is on by default');
});

test('no "inside Claude" runtime paths are left (window.claude.use)', () => {
  const hits = files.filter(f => /\bclaude\.use\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.deepEqual(hits, []);
});

test('learning-only line: the footer string is reused for the page note and the printed sheets', () => {
  const site = fs.readFileSync(path.join(ROOT, 'site.js'), 'utf8');
  const TRAIN = 'Training material only. Always follow the AIP, the flight manual and your operator’s procedures.';
  assert.ok(site.includes(`const TRAIN='${TRAIN}'`) && site.includes(`'${TRAIN}':'Kun opplæringsmateriell. Følg alltid AIP, flyhåndboken og operatørens prosedyrer.'`));
  for (const p of ['prep.html', 'sheets.html', 'essentials.html', 'radio.html', 'checkride.html', 'wxreports.html']) assert.ok(site.includes(`'${p}'`), p);
  assert.match(fs.readFileSync(path.join(ROOT, 'prep.html'), 'utf8'), /\.sheet::after,\.clprint::after\{content:var\(--bb-train/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sheets.html'), 'utf8'), /\.a5::after\{content:var\(--bb-train/);
});
