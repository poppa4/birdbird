/* Birdbird – everything Birdbird keeps on this device, in one place: list it, download it, delete it.
   Used by privacy.html ("Clear Birdbird data") and profile.html ("Download all my data", account deletion).
   Loaded only on those pages. Never touches the server account (deleting that is a separate action on My page).

   What Birdbird stores on a device (found by searching the code for localStorage, sessionStorage and indexedDB):
   - localStorage and sessionStorage keys starting with one of PREFIXES (bb-…, naeroson…, aeroson…, vlab-…, fi-…, birdbird-…)
   - IndexedDB databases in DBS: birdbird-workspace (My Workspace items, notes, ink, settings, trashed files),
     naeroson-fi (Flight Intelligence / workspace documents and their files), naeroson-docs (older document store),
     naeroson-att (images attached to briefing packs and routes)
   tests/localdata.test.mjs fails if a new key or database appears in the code that this file does not cover. */
(function (G) {
  'use strict';
  const PREFIXES = ['bb-', 'naeroson', 'aeroson', 'vlab-', 'fi-', 'birdbird-'];
  const DBS = ['birdbird-workspace', 'naeroson-fi', 'naeroson-docs', 'naeroson-att'];
  const LANG = 'vlab-lang';
  const ours = k => typeof k === 'string' && PREFIXES.some(p => k.indexOf(p) === 0);

  function storeOf(name) { try { const s = G[name]; s.getItem('x'); return s; } catch (e) { return null; } }
  function keysOf(s) { const o = []; if (!s) return o; try { for (let i = 0; i < s.length; i++) { const k = s.key(i); if (ours(k)) o.push(k); } } catch (e) {} return o.sort(); }

  /* the databases that exist (indexedDB.databases() where the browser has it; otherwise all of DBS, opened without creating) */
  async function existingDbs() {
    const idb = G.indexedDB; if (!idb) return [];
    if (typeof idb.databases === 'function') { try { const l = await idb.databases(); return DBS.filter(n => l.some(d => d && d.name === n)); } catch (e) {} }
    return DBS.slice();
  }
  /* open an existing database without creating it (an upgrade from version 0 means it did not exist: abort it) */
  function openExisting(name) {
    return new Promise(res => {
      let r; try { r = G.indexedDB.open(name); } catch (e) { return res(null); }
      r.onupgradeneeded = e => { try { e.target.transaction.abort(); } catch (x) {} };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    });
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  /* make any stored value JSON-safe; files and binary data are replaced by a short description */
  function ser(v, d) {
    d = d || 0;
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (d > 40) return null;
    if (typeof Blob !== 'undefined' && v instanceof Blob) return { $file: 'not included', name: v.name || undefined, type: v.type || undefined, bytes: v.size };
    if (v instanceof ArrayBuffer) return { $binary: 'not included', bytes: v.byteLength };
    if (ArrayBuffer.isView(v)) return { $binary: 'not included', bytes: v.byteLength };
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(x => ser(x, d + 1));
    if (v instanceof Map) { const o = {}; v.forEach((x, k) => { o[String(k)] = ser(x, d + 1); }); return o; }
    if (v instanceof Set) return [...v].map(x => ser(x, d + 1));
    if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = ser(v[k], d + 1); return o; }
    return null;
  }

  async function dumpDb(name) {
    const db = await openExisting(name); if (!db) return null;
    const out = {};
    try {
      for (const st of [...db.objectStoreNames]) {
        try {
          const s = db.transaction(st).objectStore(st);
          const [vals, keys] = await Promise.all([rq(s.getAll()), rq(s.getAllKeys())]);
          out[st] = s.keyPath ? vals.map(v => ser(v)) : keys.map((k, i) => ({ key: ser(k), value: ser(vals[i]) }));
        } catch (e) { out[st] = { error: 'could not be read' }; }
      }
    } finally { try { db.close(); } catch (e) {} }
    return out;
  }

  /* what is stored now: { local:[keys], session:[keys], dbs:[names] } */
  async function inventory() {
    return { local: keysOf(storeOf('localStorage')), session: keysOf(storeOf('sessionStorage')), dbs: await existingDbs() };
  }

  /* everything on this device as one object; `keys` has the same shape as the older progress file, so Import reads both */
  async function exportLocal() {
    const ls = storeOf('localStorage'), ss = storeOf('sessionStorage');
    const keys = {}, session = {}, indexedDB = {};
    keysOf(ls).forEach(k => { try { keys[k] = ls.getItem(k); } catch (e) {} });
    keysOf(ss).forEach(k => { try { session[k] = ss.getItem(k); } catch (e) {} });
    for (const n of await existingDbs()) { const d = await dumpDb(n); if (d) indexedDB[n] = d; }
    return { keys, sessionStorage: session, indexedDB };
  }

  function deleteDb(name) {
    return new Promise(r => { try { const q = G.indexedDB.deleteDatabase(name); q.onsuccess = () => r('deleted'); q.onerror = () => r('error'); q.onblocked = () => r('blocked'); } catch (e) { r('error'); } });
  }
  /* delete every Birdbird key and database on this device. opts.keepLang (default true) keeps the language choice.
     Removals are not synced to the account (account.js wipeLocal does them without noting a change). */
  async function clearAll(opts) {
    const keepLang = !opts || opts.keepLang !== false;
    const ls = storeOf('localStorage'), ss = storeOf('sessionStorage');
    const lang = ls ? ls.getItem(LANG) : null;
    const lk = keysOf(ls), sk = keysOf(ss);
    const drop = k => ours(k) && !(keepLang && k === LANG);
    if (G.BBACCOUNT && typeof G.BBACCOUNT.wipeLocal === 'function') { try { G.BBACCOUNT.wipeLocal(drop); } catch (e) {} }
    // only what is still there: a removal through account.js's storage hook would otherwise note a change and write its link back
    if (ls) lk.filter(drop).forEach(k => { try { if (ls.getItem(k) !== null) ls.removeItem(k); } catch (e) {} });
    if (ss) sk.forEach(k => { try { ss.removeItem(k); } catch (e) {} });
    if (ls && keepLang && lang != null && ls.getItem(LANG) !== lang) { try { ls.setItem(LANG, lang); } catch (e) {} }
    const dbs = {};
    await Promise.all(DBS.map(async n => { dbs[n] = await deleteDb(n); }));
    try { G.document.dispatchEvent(new Event('nprog')); } catch (e) {}
    return { local: lk.filter(drop).length, session: sk.length, dbs };
  }

  G.BBLOCAL = { PREFIXES, DBS, ours, inventory, exportLocal, clearAll, ser };
})(typeof window !== 'undefined' ? window : globalThis);
