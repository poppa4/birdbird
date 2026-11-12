/* Birdbird – My Workspace (page). Logic lives in workspacecore.js; this file is storage, sync and the views.
   Kept on this device   IndexedDB 'birdbird-workspace' (items, device settings, trashed document files), with a
                         localStorage fallback; document files and their text in 'naeroson-fi' – the same store
                         Flight Intelligence uses, so a document added in either place shows in both.
   Synced to the account aircraft, the document index (name, category, links, tags), pack marks -> namespace 'workspace';
                         notes with their version history -> namespace 'notes'. Document files are never uploaded.
   The desk             desk.js draws the default view (#/): panes with tabs, saved as 'desk' items (positions only) in the
                         'workspace' namespace. The list views below are the Library (#/library, #/documents …).
   Pen notebooks         items of kind 'notebook' (and 'ink' for the ink on a PDF page) in the 'ink' namespace; drawn by
                         notebook.js, model in inkcore.js. Same autosave, versions, trash and backup as notes. When the
                         namespace is too big for the account, the largest notebooks stay on this device (and say so). */
(function () {
  'use strict';
  const W = window.WSCORE, LAB = window.LAB, NSTORE = window.NSTORE;
  const el = id => document.getElementById(id);
  const t = (en, no) => LAB.lang === 'en' ? en : (no == null ? en : no);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const loc = () => LAB.lang === 'en' ? 'en-GB' : 'nb-NO';
  const day = ts => ts ? new Date(ts).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '–';
  const clock = ts => new Date(ts).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
  const dayClock = ts => day(ts) + ' ' + clock(ts);
  function ago(ts) { if (!ts) return '–'; const s = (Date.now() - ts) / 1000; if (s < 50) return t('just now', 'nå nettopp'); if (s < 3300) { const m = Math.max(1, Math.round(s / 60)); return t(m + ' min ago', m + ' min siden'); } if (s < 86400) { const h = Math.round(s / 3600); return t(h + ' h ago', h + ' t siden'); } if (s < 7 * 86400) { const d = Math.round(s / 86400); return t(d + (d === 1 ? ' day ago' : ' days ago'), d + (d === 1 ? ' dag siden' : ' dager siden')); } return day(ts); }
  const plural = (n, en1, enN, no1, noN) => n + ' ' + t(n === 1 ? en1 : enN, n === 1 ? no1 : noN);
  const main = el('wsMain');
  /* the desk is the default view: decide before the first paint so the Library header does not flash */
  document.documentElement.classList.toggle('ws-deskmode', /^#?\/?(desk)?(\?|$)/.test(location.hash));

  /* ---------- names ---------- */
  const CAT = { afm: ['AFM / POH', 'AFM / POH'], sop: ['SOP', 'SOP'], chk: ['Checklists', 'Sjekklister'], company: ['Company manuals', 'Selskapsmanualer'], charts: ['Charts', 'Kart'], other: ['Other', 'Annet'] };
  const catName = c => t.apply(null, CAT[c] || CAT.other);
  const KIND = { aircraft: ['Aircraft', 'Fly'], doc: ['Document', 'Dokument'], note: ['Note', 'Notat'], pack: ['Briefing pack', 'Briefingpakke'], route: ['Route', 'Rute'], desk: ['Desk', 'Arbeidsflate'], notebook: ['Notebook', 'Notatbok'] };
  const kindName = k => t.apply(null, KIND[k] || ['', '']);
  const acName = a => a ? ([a.type || W.typeOf(a.typeKey).name, a.reg].filter(Boolean).join(' · ') || t('Aircraft', 'Fly')) : '';
  const noteTitle = n => W.noteAutoTitle(n) || t('Untitled note', 'Notat uten tittel');
  const packTitle = p => { const f = p.f || {}; return (p.title || '').trim() || (f.heading || '').trim() || [f.depapt, f.destapt].filter(Boolean).join(' – ') || t('Untitled briefing pack', 'Briefingpakke uten navn'); };
  const routeTitle = r => { const rw = (r.pts || []).filter(x => x.t === 'rwy').map(x => x.n); return (r.title || '').trim() || (rw.length ? [rw[0], rw[rw.length - 1]].filter((v, i, a) => i === 0 || v !== a[0]).join(' – ') : t('Untitled route', 'Rute uten navn')); };
  const realPack = p => { const f = p && p.f || {}; return !!(f.depapt || f.destapt || f.reg || f.type || (p.title || '').trim() || (f.heading || '').trim()); };
  function guessTypeKey(s) { s = String(s || ''); return /172/.test(s) ? 'c172' : /da[\s-]?42/i.test(s) ? 'da42' : /b200|king\s?air/i.test(s) ? 'b200' : /pa[\s-]?28|warrior|archer|cherokee/i.test(s) ? 'pa28' : /da[\s-]?40/i.test(s) ? 'da40' : /p2006/i.test(s) ? 'p2006t' : /pa[\s-]?34|seneca/i.test(s) ? 'pa34' : /a3(19|20|21)/i.test(s) ? 'a320' : 'other'; }
  const TRAINER = { 'c172.html': ['Cessna 172 trainer', 'Cessna 172-trener'], 'cockpit.html': ['DA42 simulator', 'DA42-simulator'], 'b200.html': ['King Air B200 trainer', 'King Air B200-trener'], 'simcheck.html': ['A320 sim assessment', 'A320 simulatortest'] };

  /* ---------- "Use in the trainer": a checklist or SOP document becomes the student's own checklist in a cockpit trainer.
     Only the index (type -> document id and name) is written ('bb-ownck', synced as a setting); the trainer reads the text
     from this device's document store, so the document itself never leaves the device. ---------- */
  const OCK_TR = [['DA42', 'cockpit.html'], ['C172', 'c172.html'], ['B200', 'b200.html']];
  function useInTrainer(type, id) {
    const d = item(id); if (!d) return;
    try { const o = JSON.parse(localStorage.getItem('bb-ownck') || '{}') || {}; o[type] = { src: 'doc', id, name: d.name || '', score: (o[type] && o[type].score) || 0 }; localStorage.setItem('bb-ownck', JSON.stringify(o));
      const c = JSON.parse(localStorage.getItem('bb-ownck-text') || '{}') || {}; delete c[type]; localStorage.setItem('bb-ownck-text', JSON.stringify(c)); } catch (e) {}
  }
  const ockCan = d => !!d && (d.cat === 'chk' || d.cat === 'sop');
  const ockLinks = id => OCK_TR.map(([ty, pg]) => `<a class="btn sm" href="${pg}" data-ock="${ty}" data-id="${esc(id)}">${esc(t('Use in the ' + ty + ' trainer', 'Bruk i ' + ty + '-treneren'))}</a>`).join('');
  document.addEventListener('click', e => { const a = e.target.closest('[data-ock]'); if (a) useInTrainer(a.dataset.ock, a.dataset.id); });

  /* ---------- storage on this device ---------- */
  function openIdb(name, ver, up) { return new Promise(res => { try { const r = indexedDB.open(name, ver); r.onupgradeneeded = () => up(r.result); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); } catch (e) { res(null); } }); }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txDone = tx => new Promise((res, rej) => { tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => rej(tx.error || new Error('write failed')); });
  let LS = null; try { LS = window.localStorage; LS.getItem('x'); } catch (e) { LS = null; }
  const LSI = 'bb-ws-items', LSK = 'bb-ws-kv';
  const lsJson = (k, d) => { try { const v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const ST = {
    db: null, mode: 'idb',
    async open() { this.db = await openIdb('birdbird-workspace', 1, db => { db.createObjectStore('items', { keyPath: 'id' }); db.createObjectStore('kv'); db.createObjectStore('trashdocs', { keyPath: 'id' }); }); if (!this.db) this.mode = LS ? 'ls' : 'none'; },
    async loadItems() { const o = {}; if (this.db) (await rq(this.db.transaction('items').objectStore('items').getAll())).forEach(it => { o[it.id] = it; }); else if (LS) Object.assign(o, lsJson(LSI, {})); return o; },
    async putItems(list) { if (!list.length) return; if (this.db) { const tx = this.db.transaction('items', 'readwrite'), s = tx.objectStore('items'); list.forEach(it => s.put(it)); await txDone(tx); } else if (LS) { const o = lsJson(LSI, {}); list.forEach(it => { o[it.id] = it; }); LS.setItem(LSI, JSON.stringify(o)); } else throw new Error('no storage'); },
    async clearItems() { if (this.db) { const tx = this.db.transaction(['items', 'trashdocs'], 'readwrite'); tx.objectStore('items').clear(); tx.objectStore('trashdocs').clear(); await txDone(tx); } else if (LS) LS.removeItem(LSI); },
    async kvGet(k) { try { if (this.db) return await rq(this.db.transaction('kv').objectStore('kv').get(k)); return LS ? lsJson(LSK, {})[k] : undefined; } catch (e) { return undefined; } },
    async kvSet(k, v) { try { if (this.db) { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); await txDone(tx); } else if (LS) { const o = lsJson(LSK, {}); o[k] = v; LS.setItem(LSK, JSON.stringify(o)); } } catch (e) {} },
    async tdPut(rec) { if (!this.db) return; const tx = this.db.transaction('trashdocs', 'readwrite'); tx.objectStore('trashdocs').put(rec); await txDone(tx); },
    async tdGet(id) { if (!this.db) return null; try { return await rq(this.db.transaction('trashdocs').objectStore('trashdocs').get(id)); } catch (e) { return null; } },
    async tdDel(id) { if (!this.db) return; try { const tx = this.db.transaction('trashdocs', 'readwrite'); tx.objectStore('trashdocs').delete(id); await txDone(tx); } catch (e) {} }
  };
  /* the document store shared with Flight Intelligence (fi.html): 'docs' { id, ac, name, kind, rev, on, pages, chunks, added, blob } and 'blobs' { id, blob } */
  const FI = {
    db: null,
    async open() { this.db = await openIdb('naeroson-fi', 1, db => { db.createObjectStore('docs', { keyPath: 'id' }); db.createObjectStore('blobs', { keyPath: 'id' }); }); },
    async load() { S.docs = {}; S.blobs = new Set(); if (!this.db) return; try { (await rq(this.db.transaction('docs').objectStore('docs').getAll())).forEach(d => { if (d && d.id && !d.builtin) S.docs[d.id] = d; }); (await rq(this.db.transaction('blobs').objectStore('blobs').getAllKeys())).forEach(k => S.blobs.add(k)); } catch (e) {} },
    async put(doc, blob) { if (!this.db) throw new Error('no storage'); const tx = this.db.transaction(['docs', 'blobs'], 'readwrite'); tx.objectStore('docs').put(doc); if (blob) tx.objectStore('blobs').put({ id: doc.id, blob }); await txDone(tx); S.docs[doc.id] = doc; if (blob) S.blobs.add(doc.id); },
    async getBlob(id) { if (!this.db) return null; try { const r = await rq(this.db.transaction('blobs').objectStore('blobs').get(id)); return r && r.blob || null; } catch (e) { return null; } },
    async del(id) { delete S.docs[id]; S.blobs.delete(id); if (!this.db) return; try { const tx = this.db.transaction(['docs', 'blobs'], 'readwrite'); tx.objectStore('docs').delete(id); tx.objectStore('blobs').delete(id); await txDone(tx); } catch (e) {} }
  };

  /* ---------- state ---------- */
  const S = { ready: false, items: {}, docs: {}, blobs: new Set(), packs: [], routes: [], fiac: [], prepAc: [], est: { usage: 0, quota: 0, persisted: null }, index: null };
  let M = { sync: { uid: null, last: 0, base: 0, paused: null, full: null }, recent: [], backupAt: 0, hideAdopt: {} };
  const F = { docs: { q: '', cat: '', ac: '' }, packs: { q: '', ac: '', when: '' }, notes: { q: '', tag: '' } };
  const saveMeta = () => ST.kvSet('meta', M);
  let pending = 0, saveErr = null, lastSaved = 0;
  function persist(p) { pending++; drawStatus(); return p.then(() => { lastSaved = Date.now(); saveErr = null; }, e => { saveErr = e || new Error('save'); }).then(() => { pending--; drawStatus(); }); }
  /* every change goes through here: memory, this device at once, then the account */
  let readyRes, itemsIn = false; const readyP = new Promise(r => { readyRes = r; });
  function commit(list, opts) {
    /* a change made before the stores have been read waits for them, so it is neither lost nor written to the wrong place */
    if (!itemsIn) return readyP.then(() => commit(list, opts));
    list = Array.isArray(list) ? list : [list];
    list.forEach(it => { S.items[it.id] = it; });
    S.index = null;
    const p = persist(ST.putItems(list));
    if (!opts || !opts.local) scheduleSync(opts && opts.wait);
    return p;
  }
  const item = id => S.items[id];
  const liveOf = kind => W.live(S.items, kind);
  const aircraft = () => liveOf('aircraft').sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || acName(a).localeCompare(acName(b)));
  const docsAll = () => liveOf('doc').sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const notesAll = () => liveOf('note').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
  const notebooksAll = () => liveOf('notebook').sort((a, b) => b.updatedAt - a.updatedAt);
  const hasFile = id => S.blobs.has(id);
  const onDevice = id => !!S.docs[id];
  const packMark = id => { const m = S.items['pk:' + id]; return m && W.isLive(m) ? m : null; };
  const normReg = s => String(s || '').toUpperCase().replace(/[\s-]/g, '');
  function packAc(p) { const m = packMark(p.id); if (m && m.acId && W.isLive(item(m.acId))) return item(m.acId); const r = normReg(p.f && p.f.reg); if (r) return aircraft().find(a => normReg(a.reg) === r) || null; return window.FLIGHT ? window.FLIGHT.matchAircraft(p, aircraft(), a => W.typeOf(a.typeKey).name) : null; }
  const packsAll = () => S.packs.slice().sort((a, b) => ((packMark(b.id) || {}).pinned ? 1 : 0) - ((packMark(a.id) || {}).pinned ? 1 : 0) || (b.updated || b.created || 0) - (a.updated || a.created || 0));

  async function loadStores() {
    try { await NSTORE.ready; const [p, r, fa, pa] = await Promise.all(['prep', 'route', 'fiac', 'aircraft'].map(k => NSTORE.list(k).catch(() => [])));
      S.packs = (p || []).filter(realPack); S.routes = (r || []).filter(x => x && (x.pts || []).length > 0); S.fiac = fa || []; S.prepAc = pa || []; } catch (e) {}
    S.index = null;
  }
  async function storageInfo() { try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); S.est.usage = e.usage || 0; S.est.quota = e.quota || 0; } if (navigator.storage && navigator.storage.persisted) S.est.persisted = await navigator.storage.persisted(); } catch (e) {} }
  async function askPersist() { try { if (navigator.storage && navigator.storage.persist && S.est.persisted !== true) S.est.persisted = await navigator.storage.persist(); } catch (e) {} }

  /* ---------- documents: keep the index and the stored files in step ---------- */
  const extOf = n => { const m = /\.([a-z0-9]{1,5})$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
  async function trashFile(id) { const d = S.docs[id]; if (!d) return; const blob = hasFile(id) ? await FI.getBlob(id) : null; await ST.tdPut({ id, doc: d, blob }); await FI.del(id); }
  async function untrashFile(id) { const r = await ST.tdGet(id); if (!r) return false; await FI.put(r.doc, r.blob || null); await ST.tdDel(id); return true; }
  async function reconcile() {
    const add = [];
    for (const d of Object.values(S.docs)) {
      let e = S.items[d.id];
      if (!e) {
        const twin = liveOf('doc').find(x => !S.docs[x.id] && x.name === d.name && (!x.pages || x.pages === d.pages));
        if (twin) { const blob = hasFile(d.id) ? await FI.getBlob(d.id) : null; const nd = Object.assign({}, d, { id: twin.id }); await FI.put(nd, blob); await FI.del(d.id); continue; }
        let size = d.file && d.file.size || 0; if (!size && hasFile(d.id)) { const b = await FI.getBlob(d.id); size = b ? b.size : 0; }
        const acIds = liveOf('aircraft').filter(a => a.fiac && a.fiac === d.ac).map(a => a.id);
        add.push(W.newDocEntry({ id: d.id, name: d.name, cat: W.kindToCat(d.kind), acIds, rev: d.rev, pages: d.pages, size, ext: d.file ? extOf(d.file.name) : (d.blob ? 'pdf' : ''), createdAt: d.added || Date.now() }, d.added || Date.now()));
      } else if (e.gone) await FI.del(d.id);
      else if (W.inTrash(e)) await trashFile(d.id);
      else if (e.name && e.name !== d.name) { try { await FI.put(Object.assign({}, d, { name: e.name }), null); } catch (er) {} }
    }
    for (const e of Object.values(S.items)) { if (e.kind !== 'doc') continue; if (e.gone) ST.tdDel(e.id); else if (W.isLive(e) && !S.docs[e.id]) await untrashFile(e.id); }
    if (add.length) await commit(add);
  }
  async function ensureFiac(a) {
    if (a.fiac && S.fiac.some(x => x.id === a.fiac)) return a.fiac;
    const f = { id: 'ac' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: acName(a).slice(0, 60), type: (a.type || '').slice(0, 60), created: Date.now() };
    await NSTORE.put('fiac', f); S.fiac.push(f);
    await commit(W.patch(item(a.id), { fiac: f.id }));
    return f.id;
  }
  /* the stored document follows the index entry: name, type, and the aircraft it shows under in Flight Intelligence */
  async function pushDocToFi(e) {
    const d = S.docs[e.id]; if (!d) return;
    const first = (e.acIds || []).map(item).find(W.isLive);
    const ac = first ? await ensureFiac(first) : 'gen';
    const kind = W.kindToCat(d.kind) === e.cat ? d.kind : W.catToKind(e.cat);
    if (d.name !== e.name || d.ac !== ac || d.kind !== kind || (d.rev || '') !== (e.rev || '')) { try { await FI.put(Object.assign({}, d, { name: e.name, ac, kind, rev: e.rev || '' }), null); } catch (er) {} }
  }

  /* ---------- reading files ---------- */
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
  async function pdfjs() { if (!window.pdfjsLib) { await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; } return window.pdfjsLib; }
  async function readText(f, onProg) {
    const ext = extOf(f.name), chunks = []; let pages = 1, sec = '';
    if (ext === 'pdf') { const lib = await pdfjs(); const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise; pages = doc.numPages;
      for (let i = 1; i <= pages; i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); const tx = tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join(''); const g = W.guessSec(tx.slice(0, 400)); if (g) sec = g; W.chunkPage(tx, i, chunks, sec); onProg(i / pages); pg.cleanup(); }
      try { doc.destroy(); } catch (e) {} }
    else if (ext === 'docx') { if (!window.mammoth) await loadScript('vendor/mammoth.browser.min.js'); const r = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() }); pages = W.byParts(r.value, chunks); }
    else if (ext === 'txt' || ext === 'md' || /^text\//.test(f.type)) pages = W.byParts(await f.text(), chunks);
    onProg(1);
    return { pages, chunks };
  }
  let adding = false;
  /* opts: { acId, replaceId } */
  async function addFiles(files, opts) {
    opts = opts || {}; if (adding || !files.length) return; adding = true;
    if (!FI.db) { adding = false; toast(t('This browser cannot store files here (private browsing?). Notes and aircraft still work.', 'Denne nettleseren kan ikke lagre filer her (privat modus?). Notater og fly fungerer fortsatt.')); return; }
    askPersist();
    const prog = el('wsProg'); const show = (name, v) => { if (prog) { prog.hidden = false; prog.firstElementChild.textContent = t('Reading ', 'Leser ') + name + '…'; prog.querySelector('i').style.width = Math.round(v * 100) + '%'; } };
    const done = [], failed = []; let lastId = null;
    for (const f of files) {
      show(f.name, 0);
      try {
        await storageInfo();
        if (S.est.quota && f.size > S.est.quota - S.est.usage) { failed.push(f.name + ': ' + t('not enough free space on this device', 'ikke nok ledig plass på denne enheten')); continue; }
        let r = { pages: 1, chunks: [] };
        try { r = await readText(f, v => show(f.name, v)); } catch (e) { /* no text (scanned, protected or an image): the file is still kept */ }
        const base = f.name.replace(/\.(pdf|docx|txt|md|png|jpe?g|webp)$/i, '');
        const twin = opts.replaceId ? item(opts.replaceId) : liveOf('doc').find(x => !onDevice(x.id) && x.name === base);
        const id = twin ? twin.id : 'fd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const old = S.docs[id];
        const doc = Object.assign({ id, ac: 'gen', name: base, kind: W.guessKind(f.name), rev: '', old: false, on: true, added: Date.now() }, old || {}, { pages: r.pages, chunks: r.chunks, blob: extOf(f.name) === 'pdf', file: { name: f.name, type: f.type || '', size: f.size } });
        await FI.put(doc, f);
        let e;
        if (twin) e = W.patch(twin, { pages: r.pages, size: f.size, ext: extOf(f.name) });
        else e = W.newDocEntry({ id, name: base, cat: W.guessCat(f.name), acIds: opts.acId ? [opts.acId] : [], pages: r.pages, size: f.size, ext: extOf(f.name) });
        await commit(e); await pushDocToFi(e);
        done.push(e.name); lastId = id;
      } catch (e) { failed.push(f.name + ': ' + (e && e.name === 'QuotaExceededError' ? t('not enough free space on this device', 'ikke nok ledig plass på denne enheten') : t('could not be saved', 'kunne ikke lagres'))); }
    }
    adding = false; if (prog) prog.hidden = true;
    await storageInfo(); render();
    const onDesk = deskMode() && window.WSDESK;
    if (onDesk && lastId && !opts.replaceId) window.WSDESK.openItem('doc', lastId);
    if (failed.length) toast(failed.join(' · '));
    else if (done.length) toast(t('Saved on this device: ', 'Lagret på denne enheten: ') + done.join(', '), done.length === 1 && lastId && !onDesk && !/^documents\//.test(route().path) ? [t('Open', 'Åpne'), () => go('documents/' + lastId)] : null);
  }
  /* attach a document to an aircraft (from the aircraft card on the desk) */
  async function linkDoc(docId, acId) { const d = item(docId); if (!W.isLive(d) || (d.acIds || []).includes(acId)) return; const e = W.patch(d, { acIds: (d.acIds || []).concat([acId]) }); await commit(e); await pushDocToFi(e); render(); }
  function pickFiles(opts) { const inp = el('wsFile'); inp.multiple = !(opts && opts.replaceId); inp.onchange = () => { const fs = [...inp.files]; inp.value = ''; addFiles(fs, opts); }; inp.click(); }

  /* ---------- sync with the account ---------- */
  const user = () => (window.BBACCOUNT && window.BBACCOUNT.user) || null;
  const SY = { state: 'idle', err: null, running: false, again: false, timer: 0, lastRun: 0 };
  async function call(method, path, body) {
    let r; try { r = await fetch('/api' + path, { method, credentials: 'same-origin', cache: 'no-store', headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); } catch (e) { return { status: 0, j: null }; }
    let j = null; if ((r.headers.get('content-type') || '').includes('application/json')) { try { j = await r.json(); } catch (e) {} }
    return { status: r.status, j };
  }
  function scheduleSync(wait) { if (!user()) return; if (SY.running) { SY.again = true; return; } clearTimeout(SY.timer); SY.timer = setTimeout(() => syncNow(), Math.max(wait || 2000, SY.lastRun + 6000 - Date.now())); }
  async function syncNow(manual) {
    const u = user(); if (!u || !S.ready) return;
    if (SY.running) { SY.again = true; return; }
    if (M.sync.paused && M.sync.paused === u.id && !manual) { SY.state = 'paused'; drawStatus(); return; }
    clearTimeout(SY.timer); SY.running = true; SY.state = 'syncing'; SY.lastRun = Date.now(); drawStatus();
    const started = Date.now();
    try {
      const g = await call('GET', '/sync');
      if (g.status === 0) throw { code: 'offline' };
      if (g.status === 401) throw { code: 'signed_out' };
      if (!g.j || !g.j.ok) throw { code: (g.j && g.j.error) || 'no_backend' };
      if (M.sync.uid && u.id && M.sync.uid !== u.id && W.live(S.items).length) {
        const yes = await confirmDlg({ title: t('Add this device’s workspace to this account?', 'Legge arbeidsområdet på denne enheten til denne kontoen?'),
          text: t('The workspace on this device was last synced to a different Birdbird account. If you continue, its aircraft, notes and document list are combined with this account. Nothing is deleted.', 'Arbeidsområdet på denne enheten ble sist synkronisert med en annen Birdbird-konto. Hvis du fortsetter, slås flyene, notatene og dokumentlisten sammen med denne kontoen. Ingenting slettes.'),
          ok: t('Combine with this account', 'Slå sammen med denne kontoen'), cancel: t('Keep on this device only', 'Behold bare på denne enheten') });
        if (!yes) { M.sync.paused = u.id; saveMeta(); throw { code: 'paused' }; }
        M.sync.base = 0;
      }
      M.sync.paused = null;
      const put = async body => { const r = await call('PUT', '/sync', body); if (r.j && r.j.ok) return r.j; if (r.status === 409 && r.j) return { ok: false, error: 'conflict', current: r.j.current }; return { ok: false, error: (r.j && r.j.error) || (r.status === 0 ? 'offline' : 'failed') }; };
      const parts = W.splitNs(S.items), changed = [], conflicts = []; let full = null, err = null;
      for (const ns of W.NAMESPACES) {
        const r = await W.syncNs(ns, parts[ns], g.j.ns && g.j.ns[ns], put, { base: M.sync.base || 0 });
        for (const id in r.items) { const fin = W.mergeItem(S.items[id], r.items[id], M.sync.base || 0).item; if (W.stable(fin) !== W.stable(S.items[id])) { S.items[id] = fin; changed.push(fin); } }
        r.conflicts.forEach(id => conflicts.push(id));
        if (r.leftOut.length || r.trimmedVersions) { full = full || {}; full[ns] = { leftOut: r.leftOut, trimmed: r.trimmedVersions }; }
        if (r.error) err = r.error;
      }
      if (changed.length) { S.index = null; await persist(ST.putItems(changed)); await reconcile(); remoteChanged(changed); }
      M.sync.uid = u.id || M.sync.uid; M.sync.full = full;
      if (!err) { M.sync.last = Date.now(); M.sync.base = started; }
      saveMeta();
      SY.state = err ? (err === 'offline' ? 'offline' : 'error') : 'idle'; SY.err = err;
      const cn = conflicts.map(item).filter(x => x && x.kind === 'note' && W.isLive(x));
      if (cn.length) toast(t('Two devices changed “' + noteTitle(cn[0]) + '” at the same time. The other text is kept in the note’s version history.', 'To enheter endret «' + noteTitle(cn[0]) + '» samtidig. Den andre teksten ligger i versjonshistorikken til notatet.'), [t('Open', 'Åpne'), () => go('notes/' + cn[0].id)]);
    } catch (e) {
      const c = e && e.code;
      SY.state = c === 'offline' ? 'offline' : c === 'paused' ? 'paused' : c === 'signed_out' ? 'idle' : 'error'; SY.err = c || 'failed';
      if (c === 'signed_out' && window.BBACCOUNT) window.BBACCOUNT.refreshMe().catch(() => {});
    } finally {
      SY.running = false; drawStatus();
      if (SY.again) { SY.again = false; scheduleSync(1500); }
      else if (SY.state === 'error' && SY.err !== 'no_backend' && SY.err !== 'no_db') { clearTimeout(SY.timer); SY.timer = setTimeout(() => syncNow(), 30000); }
    }
  }
  /* newer data arrived from another device: redraw, but never under someone's typing */
  let redrawOnBlur = false;
  function remoteChanged(list) {
    const a = document.activeElement, typing = a && main.contains(a) && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName));
    if (typing) { redrawOnBlur = true; const r = route(); if (r.path.startsWith('notes/') && list.some(x => x.id === r.path.slice(6))) toast(t('This note was also changed on another device. Both texts are kept; see the version history.', 'Dette notatet ble også endret på en annen enhet. Begge tekstene er beholdt; se versjonshistorikken.')); }
    else render();
    drawRail();
  }
  main.addEventListener('focusout', () => { if (redrawOnBlur) setTimeout(() => { const a = document.activeElement; if (redrawOnBlur && !(a && main.contains(a) && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName)))) { redrawOnBlur = false; render(); } }, 50); });

  /* ---------- small UI helpers ---------- */
  let toastT = 0;
  function toast(text, btn) {
    const b = el('wsToast'); b.innerHTML = '<span>' + esc(text) + '</span>' + (btn ? '<button type="button">' + esc(btn[0]) + '</button>' : ''); b.hidden = false;
    if (btn) b.querySelector('button').onclick = () => { b.hidden = true; btn[1](); };
    clearTimeout(toastT); toastT = setTimeout(() => { b.hidden = true; }, btn ? 9000 : 5000);
  }
  const dlg = el('wsDlg');
  function openDlg(html, wire) {
    return new Promise(res => {
      dlg.innerHTML = html; let out = null;
      const close = v => { out = v; dlg.close(); };
      dlg.onclose = () => { dlg.innerHTML = ''; res(out); };
      dlg.oncancel = null;
      dlg.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => close(null); });
      if (wire) wire(close);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      const f = dlg.querySelector('[autofocus]') || dlg.querySelector('input,select,textarea,button'); if (f) f.focus();
    });
  }
  function confirmDlg(o) {
    return openDlg(`<h3 id="wsDlgH">${esc(o.title)}</h3><p>${esc(o.text)}</p>${o.extra || ''}<div class="foot"><button type="button" class="btn" data-close>${esc(o.cancel || t('Cancel', 'Avbryt'))}</button><button type="button" class="btn ${o.danger ? 'danger' : 'pri'}" id="wsDlgOk">${esc(o.ok)}</button></div>`,
      close => { el('wsDlgOk').onclick = () => close(true); }).then(v => !!v);
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }
  const mark = (text, q) => { let h = esc(text); W.tokens(q).forEach(tk => { if (tk.length > 1) h = h.replace(new RegExp('(' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return h; };
  const tagChips = tags => (tags || []).map(x => `<span class="chip tagc"><span>#${esc(x)}</span></span>`).join('');

  /* ---------- routing ---------- */
  function route() { const h = location.hash.replace(/^#\/?/, ''); const i = h.indexOf('?'); const path = decodeURIComponent(i < 0 ? h : h.slice(0, i)); return { path, q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) }; }
  function go(path) { location.hash = '#/' + path; }
  function visit(tp, id) { M.recent = W.pushRecent(M.recent, { t: tp, id }); saveMeta(); }
  const RAIL = () => [['library', t('Overview', 'Oversikt'), null], ['map', t('Map', 'Kart'), null], ['aircraft', t('My aircraft', 'Mine fly'), aircraft().length], ['documents', t('Documents', 'Dokumenter'), docsAll().length], ['packs', t('Briefing packs', 'Briefingpakker'), S.packs.length], ['notes', t('Notes', 'Notater'), liveOf('note').length], ['routes', t('Routes', 'Ruter'), S.routes.length], null, ['trash', t('Trash', 'Papirkurv'), W.trashed(S.items).length || null], ['storage', t('Storage and backup', 'Lagring og sikkerhetskopi'), null]];
  let railMap = null;
  function drawRailMap(cur) {
    const rl = el('wsRail'); if (!rl || !window.WSMAP || !GW) return;
    let box = el('wsRailMap');
    const want = cur !== 'map' && window.innerWidth > 1180;     /* only where the rail is a column (see workspace.css) */
    if (!want) { if (railMap) { railMap.m.destroy(); railMap = null; } if (box) box.remove(); return; }
    const a = mapAny(); if (!a) return;
    if (!box) { rl.insertAdjacentHTML('afterend', `<a id="wsRailMap" class="ws-railmap" href="#/map"><span class="h"></span><span class="l"><span class="t"></span><span class="go">${t('Open map', 'Åpne kart')} →</span></span></a>`); box = el('wsRailMap'); }
    box.classList.toggle('sample', a.sample);
    box.querySelector('.t').textContent = a.sample ? t('Example map', 'Eksempelkart') : t('Your map', 'Ditt kart') + ' · ' + a.g.own;
    const sig = a.mode + ':' + LAB.lang + ':' + mapSig(a.g);
    if (railMap && railMap.sig === sig && box.contains(railMap.host)) return;
    if (railMap) railMap.m.destroy();
    const host = box.querySelector('.h'); host.innerHTML = '';
    try { railMap = { sig, host, m: window.WSMAP.mount(host, { graph: a.g, t, mini: true, sample: a.sample }) }; } catch (e) { railMap = null; console.error('rail map', e); }
  }
  window.addEventListener('resize', () => { const cur = route().path.split('/')[0] || (deskMode() ? '' : 'library'); drawRailMap(cur); });
  function drawRail() {
    const cur = route().path.split('/')[0] || (deskMode() ? '' : 'library');
    setTimeout(() => drawRailMap(cur), 0);
    el('wsRail').innerHTML = RAIL().map(r => r ? `<a href="#/${r[0]}" class="${r[0] === cur ? 'on' : ''}"${r[0] === cur ? ' aria-current="page"' : ''}><span>${esc(r[1])}</span>${r[2] != null ? `<span class="c">${r[2]}</span>` : ''}</a>` : '<span class="gap"></span>').join('');
    const rl = el('wsRail'), on = rl.querySelector('.on'); if (on && rl.scrollWidth > rl.clientWidth) { const l = on.offsetLeft - rl.offsetLeft, r = l + on.offsetWidth; if (l < rl.scrollLeft || r > rl.scrollLeft + rl.clientWidth) rl.scrollLeft = Math.max(0, l - 24); }
  }
  function drawStatus() {
    const u = user(), b = el('wsStatus'); if (!b || !S.ready) return;
    const dev = saveErr ? `<span class="st"><i class="kept warn"></i><b>${t('Could not save on this device.', 'Kunne ikke lagre på denne enheten.')}</b> ${t('The storage may be full. Export a backup now.', 'Lageret kan være fullt. Eksporter en sikkerhetskopi nå.')}</span>`
      : `<span class="st"><i class="kept dev"></i><b>${pending ? t('Saving…', 'Lagrer …') : t('Saved on this device', 'Lagret på denne enheten')}</b>${!pending && lastSaved ? ' ' + clock(lastSaved) : ''}</span>`;
    let acc;
    if (!u) acc = `<span class="st"><i class="kept off"></i>${t('Not signed in. Kept on this device only.', 'Ikke logget inn. Lagres bare på denne enheten.')}</span><a href="profile.html#account">${t('Sign in to sync', 'Logg inn for å synkronisere')}</a>`;
    else if (SY.state === 'syncing') acc = `<span class="st"><i class="kept wait"></i>${t('Syncing to your account…', 'Synkroniserer med kontoen din …')}</span>`;
    else if (SY.state === 'offline') acc = `<span class="st"><i class="kept warn"></i>${t('No connection. Changes are saved here and sync when you are back online.', 'Ingen forbindelse. Endringer lagres her og synkroniseres når du er på nett igjen.')}</span>`;
    else if (SY.state === 'paused') acc = `<span class="st"><i class="kept off"></i>${t('Not synced to this account. Kept on this device only.', 'Ikke synkronisert med denne kontoen. Lagres bare på denne enheten.')}</span><button type="button" class="lk" data-act="sync">${t('Sync to this account', 'Synkroniser med denne kontoen')}</button>`;
    else if (SY.state === 'error') acc = `<span class="st"><i class="kept warn"></i>${SY.err === 'no_backend' || SY.err === 'no_db' ? t('Accounts are not available here. Kept on this device only.', 'Kontoer er ikke tilgjengelige her. Lagres bare på denne enheten.') : SY.err === 'unreadable' ? t('The account copy could not be read, so it was left untouched. Everything is still on this device.', 'Kontokopien kunne ikke leses og ble ikke rørt. Alt ligger fortsatt på denne enheten.') : SY.err === 'rate_limited' ? t('Sync is paused for a moment. Changes are saved on this device.', 'Synkroniseringen tar en kort pause. Endringer er lagret på denne enheten.') : t('Sync did not finish. Changes are saved on this device.', 'Synkroniseringen ble ikke ferdig. Endringer er lagret på denne enheten.')}</span><button type="button" class="lk" data-act="sync">${t('Try again', 'Prøv igjen')}</button>`;
    else if (M.sync.full) acc = `<span class="st"><i class="kept warn"></i>${t('Synced, but your account space for notes is full.', 'Synkronisert, men kontoplassen for notater er full.')}</span><a href="#/storage">${t('See what stays on this device', 'Se hva som blir på denne enheten')}</a>`;
    else acc = `<span class="st"><i class="kept acc"></i>${M.sync.last ? t('Synced to your account ', 'Synkronisert med kontoen din ') + ago(M.sync.last) : t('Signed in. Sync starts in a moment.', 'Logget inn. Synkroniseringen starter straks.')}</span>`;
    b.innerHTML = dev + acc + `<span class="sp"></span><a href="#/storage">${t('Where things are kept', 'Hvor ting er lagret')}</a>`;
    if (window.WSDESK) window.WSDESK.status();
  }
  /* one short line for the desk bar: { c: dot class, s: text, title } */
  function statusShort() {
    const u = user();
    if (saveErr) return { c: 'warn', s: t('Not saved', 'Ikke lagret'), title: t('Could not save on this device. Export a backup now.', 'Kunne ikke lagre på denne enheten. Eksporter en sikkerhetskopi nå.') };
    if (pending) return { c: 'dev', s: t('Saving…', 'Lagrer …'), title: '' };
    if (!u) return { c: 'dev', s: t('Saved on this device', 'Lagret på denne enheten'), title: t('Not signed in. Kept on this device only.', 'Ikke logget inn. Lagres bare på denne enheten.') };
    if (SY.state === 'syncing') return { c: 'wait', s: t('Syncing…', 'Synkroniserer …'), title: '' };
    if (SY.state === 'offline') return { c: 'warn', s: t('Offline, saved here', 'Frakoblet, lagret her'), title: t('Changes sync when you are back online.', 'Endringer synkroniseres når du er på nett igjen.') };
    if (SY.state === 'error' || SY.state === 'paused') return { c: 'warn', s: t('Saved here, not synced', 'Lagret her, ikke synkronisert'), title: '' };
    return { c: 'acc', s: M.sync.last ? t('Synced', 'Synkronisert') : t('Saved', 'Lagret'), title: M.sync.last ? t('Synced to your account ', 'Synkronisert med kontoen din ') + ago(M.sync.last) : '' };
  }
  el('wsStatus').addEventListener('click', e => { if (e.target.closest('[data-act="sync"]')) syncNow(true); });

  /* ---------- search ---------- */
  function buildIndex() {
    const e = [];
    aircraft().forEach(a => e.push({ t: 'aircraft', id: a.id, title: acName(a), sub: [a.callsign].join(' '), text: [a.notes, (a.speeds || []).filter(r => r.v).map(r => r.k + ' ' + r.v + ' ' + r.u).join(', ')].filter(Boolean).join(' · '), tags: [], at: a.updatedAt, href: '#/aircraft/' + a.id }));
    docsAll().forEach(d => e.push({ t: 'doc', id: d.id, title: d.name, sub: catName(d.cat) + ' ' + (d.rev || '') + ' ' + (d.acIds || []).map(x => acName(item(x))).join(' '), text: '', tags: d.tags, at: d.updatedAt, href: '#/documents/' + d.id }));
    liveOf('notebook').forEach(n => e.push({ t: 'notebook', id: n.id, title: n.title || t('Notebook', 'Notatbok'), sub: t('Notebook', 'Notatbok'), text: window.INKCORE ? window.INKCORE.notebookText(n) : '', tags: [], at: n.updatedAt, href: '#/notebook/' + n.id }));
    liveOf('note').forEach(n => e.push({ t: 'note', id: n.id, title: noteTitle(n), sub: '', text: W.noteText(n), tags: n.tags, at: n.updatedAt, href: '#/notes/' + n.id }));
    S.packs.forEach(p => { const f = p.f || {}; e.push({ t: 'pack', id: p.id, title: packTitle(p), sub: [f.date, f.type, f.reg, f.rules, f.depapt, f.destapt, f.altn].filter(Boolean).join(' '), text: '', tags: [], at: p.updated || p.created, href: 'prep.html?id=' + encodeURIComponent(p.id) }); });
    S.routes.forEach(r => e.push({ t: 'route', id: r.id, title: routeTitle(r), sub: (r.pts || []).map(x => x.n).filter(Boolean).join(' '), text: '', tags: [], at: r.updated, href: 'route.html?id=' + encodeURIComponent(r.id) }));
    return W.buildIndex(e);
  }
  /* the handwriting in notebooks is searched as text by inkcore.js, loaded the first time a search needs it */
  let inkP = null;
  function needInkText() { if (window.INKCORE || inkP || !liveOf('notebook').length) return; inkP = loadScript('inkcore.js?v=1').then(() => { S.index = null; if (route().path === 'search') render(); }, () => { inkP = null; }); }
  const findAll = q => { needInkText(); return W.search(S.index || (S.index = buildIndex()), q, 60); };

  /* ---------- views ---------- */
  const acChip = a => a ? `<a class="chip" href="#/aircraft/${esc(a.id)}"><span>${esc(a.reg || a.type || acName(a))}</span></a>` : '';
  function docRow(d, q) {
    const here = onDevice(d.id);
    const meta = [catName(d.cat), d.pages ? plural(d.pages, 'page', 'pages', 'side', 'sider') : '', d.size ? W.fmtBytes(d.size) : '', d.rev ? (/^rev/i.test(d.rev) ? d.rev : t('rev ', 'rev ') + d.rev) : ''].filter(Boolean).map(esc).join(' · ');
    return `<li><div class="t"><a class="n" href="#/documents/${esc(d.id)}">${q ? mark(d.name, q) : esc(d.name)}</a><small>${meta}</small></div>
      <div class="r">${(d.acIds || []).map(item).filter(W.isLive).map(acChip).join('')}${tagChips(d.tags)}${here ? `<span class="where"><i class="kept dev"></i>${t('On this device', 'På denne enheten')}</span>` : `<span class="where"><i class="kept off"></i>${t('File not on this device', 'Filen er ikke på denne enheten')}</span><button type="button" class="lk" data-act="doc-file" data-id="${esc(d.id)}">${t('Add the file', 'Legg til filen')}</button>`}</div></li>`;
  }
  function noteCard(n) { const tx = W.noteText(n); return `<a class="nt ${n.pinned ? 'pinned' : ''}" href="#/notes/${esc(n.id)}"><b>${esc(noteTitle(n))}</b><p>${esc(tx.slice(0, 220)) || `<i>${t('Empty note', 'Tomt notat')}</i>`}</p><span class="ft"><span>${(n.tags || []).map(x => '#' + esc(x)).join(' ')}</span><span>${esc(ago(n.updatedAt))}</span></span></a>`; }
  function packRow(p, q) {
    const f = p.f || {}, m = packMark(p.id), a = packAc(p);
    const meta = [f.date, [f.type, f.reg].filter(Boolean).join(' '), f.rules].filter(Boolean).map(esc).join(' · ');
    return `<li><div class="t"><a class="n" href="prep.html?id=${encodeURIComponent(p.id)}" data-visit="pack:${esc(p.id)}">${m && m.pinned ? '<i class="pin" title="' + t('Pinned', 'Festet') + '"></i>' : ''}${q ? mark(packTitle(p), q) : esc(packTitle(p))}</a><small>${meta || t('Briefing pack', 'Briefingpakke')}</small></div>
      <div class="r">${acChip(a)}<span class="w">${esc(ago(p.updated || p.created))}</span><button type="button" class="ibtn ${m && m.pinned ? 'on' : ''}" data-act="pack-pin" data-id="${esc(p.id)}" aria-pressed="${!!(m && m.pinned)}">${m && m.pinned ? t('Unpin', 'Løsne') : t('Pin', 'Fest')}</button><button type="button" class="ibtn" data-act="pack-dup" data-id="${esc(p.id)}">${t('Duplicate', 'Dupliser')}</button></div></li>`;
  }
  const routeRow = r => { const n = (r.pts || []).length; return `<li><div class="t"><a class="n" href="route.html?id=${encodeURIComponent(r.id)}" data-visit="route:${esc(r.id)}">${esc(routeTitle(r))}</a><small><span class="mono">${n}</span> ${t(n === 1 ? 'point' : 'points', n === 1 ? 'punkt' : 'punkter')}${r.s && r.s.cr ? ' · ' + t('cruise', 'marsj') + ' <span class="mono">' + esc(r.s.cr) + ' ft</span>' : ''}</small></div><div class="r"><span class="w">${esc(ago(r.updated))}</span></div></li>`; };
  const empty = (html, btn) => `<div class="ws-empty"><p>${html}</p>${btn || ''}</div>`;

  function recentList() {
    return (M.recent || []).map(r => {
      if (r.t === 'aircraft') { const a = item(r.id); return W.isLive(a) ? { k: kindName('aircraft'), n: a.reg ? a.reg + ' · ' + (a.type || '') : acName(a), h: '#/aircraft/' + a.id, at: r.at } : null; }
      if (r.t === 'doc') { const d = item(r.id); return W.isLive(d) ? { k: catName(d.cat), n: d.name, h: '#/documents/' + d.id, at: r.at } : null; }
      if (r.t === 'note') { const n = item(r.id); return W.isLive(n) ? { k: kindName('note'), n: noteTitle(n), h: '#/notes/' + n.id, at: r.at } : null; }
      if (r.t === 'pack') { const p = S.packs.find(x => x.id === r.id); return p ? { k: kindName('pack'), n: packTitle(p), h: 'prep.html?id=' + encodeURIComponent(p.id), at: r.at, v: 'pack:' + p.id } : null; }
      if (r.t === 'route') { const x = S.routes.find(y => y.id === r.id); return x ? { k: kindName('route'), n: routeTitle(x), h: 'route.html?id=' + encodeURIComponent(x.id), at: r.at, v: 'route:' + x.id } : null; }
      return null;
    }).filter(Boolean).slice(0, 8);
  }
  const localOnlyFiles = () => Object.values(S.docs).filter(d => W.isLive(item(d.id)));
  const needsBackup = () => { const fs = localOnlyFiles(); return fs.length && fs.some(d => (d.added || 0) > (M.backupAt || 0)) ? fs.length : 0; };

  function custody() {
    const u = user(), files = localOnlyFiles(), bytes = files.reduce((a, d) => a + ((item(d.id) || {}).size || 0), 0), pct = S.est.quota ? Math.min(100, S.est.usage / S.est.quota * 100) : 0;
    const nb = needsBackup();
    return `<section class="custody" aria-label="${t('Where things are kept', 'Hvor ting er lagret')}">
      <div><h3><i class="kept dev"></i>${t('This device', 'Denne enheten')}</h3>
        <p>${t('Everything in your workspace is saved here the moment you change it', 'Alt i arbeidsområdet lagres her i det du endrer det')}${files.length ? t(', including ', ', inkludert ') + '<b>' + plural(files.length, 'document file', 'document files', 'dokumentfil', 'dokumentfiler') + '</b> (' + W.fmtBytes(bytes) + ')' : ''}.</p>
        ${S.est.quota ? `<div class="meter" role="img" aria-label="${t('Storage used', 'Brukt lagring')}"><i style="width:${pct.toFixed(1)}%"></i></div><p><span class="mono">${W.fmtBytes(S.est.usage)}</span> ${t('used of about', 'brukt av omtrent')} <span class="mono">${W.fmtBytes(S.est.quota)}</span> ${t('available to Birdbird in this browser', 'tilgjengelig for Birdbird i denne nettleseren')}</p>` : ''}</div>
      <div><h3><i class="kept ${u ? (M.sync.full ? 'warn' : 'acc') : 'off'}"></i>${t('Your account', 'Kontoen din')}</h3>
        ${u ? `<p>${t('Aircraft, notes and the document list (names, categories, links and tags) sync to your account', 'Fly, notater og dokumentlisten (navn, kategorier, koblinger og emneknagger) synkroniseres med kontoen din')}${M.sync.last ? ', ' + t('last ', 'sist ') + '<b>' + esc(ago(M.sync.last)) + '</b>' : ''}. ${t('Document files are never uploaded.', 'Dokumentfiler lastes aldri opp.')}</p>`
          : `<p>${t('Not signed in. Sign in and your aircraft, notes and document list follow you to every device. Document files are never uploaded.', 'Ikke logget inn. Logg inn, så følger fly, notater og dokumentlisten deg til alle enheter. Dokumentfiler lastes aldri opp.')}</p><a class="btn sm" href="profile.html#account">${t('Sign in or create an account', 'Logg inn eller lag en konto')}</a>`}</div>
      <div><h3><i class="kept ${nb ? 'warn' : (M.backupAt ? 'dev' : 'off')}"></i>${t('Backup file', 'Sikkerhetskopi')}</h3>
        <p>${M.backupAt ? t('Last backup ', 'Siste sikkerhetskopi ') + '<b>' + esc(day(M.backupAt)) + '</b>. ' : t('No backup made yet. ', 'Ingen sikkerhetskopi ennå. ')}${t('One file holds everything, including the document files, and can be imported on any device.', 'Én fil inneholder alt, også dokumentfilene, og kan importeres på en hvilken som helst enhet.')}</p>
        <button type="button" class="btn sm" data-act="export">${t('Export everything', 'Eksporter alt')}</button></div>
    </section>`;
  }

  function viewHome() {
    const ac = aircraft(), docs = docsAll(), notes = notesAll(), packs = packsAll(), routes = S.routes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)), rec = recentList(), nb = needsBackup();
    const P = window.NPROG; let rank = null; try { if (P) rank = P.rankOf(P.xpOf(P.load())); } catch (e) {}
    const sec = (href, title, count, body, foot) => `<section class="ovs"><header><h2><a href="${href}">${esc(title)}</a></h2>${count != null ? `<span class="c">${count}</span>` : ''}</header>${body}<footer>${foot}</footer></section>`;
    const li = (h, b, s, w, v) => `<li><a href="${h}"${v ? ` data-visit="${esc(v)}"` : ''}><b>${b}</b><small>${s || '&nbsp;'}</small><span class="w">${w || ''}</span></a></li>`;
    const cats = W.DOC_CATS.map(c => [c, docs.filter(d => d.cat === c).length]).filter(x => x[1]);
    main.innerHTML = `
      ${nb ? `<div class="ws-remind"><span>${t(`<b>${plural(nb, 'document file exists', 'document files exist', '', '')} only on this device.</b> Files are not uploaded, so a backup file is their only copy elsewhere.`, `<b>${nb} ${nb === 1 ? 'dokumentfil finnes' : 'dokumentfiler finnes'} bare på denne enheten.</b> Filer lastes ikke opp, så en sikkerhetskopi er den eneste kopien et annet sted.`)}</span><button type="button" class="btn sm" data-act="export">${t('Export everything', 'Eksporter alt')}</button></div>` : ''}
      ${rec.length ? `<p class="ws-lbl" id="recH">${t('Recently opened', 'Sist åpnet')}</p><div class="recent" role="list" aria-labelledby="recH">${rec.map(r => `<a role="listitem" href="${r.h}"${r.v ? ` data-visit="${esc(r.v)}"` : ''}><span class="k">${esc(r.k)}</span><b>${esc(r.n)}</b><small>${esc(ago(r.at))}</small></a>`).join('')}</div>` : ''}
      <div class="ov">
        ${sec('#/aircraft', t('My aircraft', 'Mine fly'), ac.length, ac.length ? `<ul>${ac.slice(0, 4).map(a => li('#/aircraft/' + a.id, esc(a.reg || a.type || acName(a)), esc([a.reg ? a.type : '', a.callsign, a.isDefault ? t('default for briefing packs', 'standard for briefingpakker') : ''].filter(Boolean).join(' · ')), docs.filter(d => (d.acIds || []).includes(a.id)).length + ' ' + t('docs', 'dok.'))).join('')}</ul>` : `<p class="none">${t('Add the aircraft you fly. Each one gathers its AFM, SOP, checklists, notes and briefing packs.', 'Legg til flyene du flyr. Hvert fly samler AFM, SOP, sjekklister, notater og briefingpakker.')}</p>`, `<button type="button" class="lk" data-act="ac-new">${t('Add aircraft', 'Legg til fly')}</button>`)}
        ${sec('#/documents', t('Documents', 'Dokumenter'), docs.length, docs.length ? `<div class="cats">${cats.map(([c, n]) => `<span>${esc(catName(c))} <b>${n}</b></span>`).join('')}</div><ul>${docs.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3).map(d => li('#/documents/' + d.id, esc(d.name), esc(catName(d.cat) + (onDevice(d.id) ? '' : ' · ' + t('file not on this device', 'filen er ikke på denne enheten'))), d.pages ? d.pages + ' ' + t('p.', 's.') : '')).join('')}</ul>` : `<p class="none">${t('Keep your AFM or POH, SOP, checklists and company manuals here. Files stay on this device and are never uploaded.', 'Ha AFM eller POH, SOP, sjekklister og selskapsmanualer her. Filene blir på denne enheten og lastes aldri opp.')}</p>`, `<button type="button" class="lk" data-act="doc-add">${t('Add documents', 'Legg til dokumenter')}</button>`)}
        ${sec('#/notes', t('Notes', 'Notater'), notes.length, notes.length ? `<ul>${notes.slice(0, 4).map(n => li('#/notes/' + n.id, (n.pinned ? '<i class="pin"></i> ' : '') + esc(noteTitle(n)), esc(W.noteText(n).slice(0, 80)), esc(ago(n.updatedAt)))).join('')}</ul>` : `<p class="none">${t('Write down what you want to remember from a lesson, a briefing or a manual. Saved as you type.', 'Skriv ned det du vil huske fra en time, en briefing eller en manual. Lagres mens du skriver.')}</p>`, `<button type="button" class="lk" data-act="note-new">${t('New note', 'Nytt notat')}</button>`)}
        ${sec('#/packs', t('Briefing packs', 'Briefingpakker'), packs.length, packs.length ? `<ul>${packs.slice(0, 4).map(p => { const f = p.f || {}, m = packMark(p.id); return li('prep.html?id=' + encodeURIComponent(p.id), (m && m.pinned ? '<i class="pin"></i> ' : '') + esc(packTitle(p)), esc([f.date, [f.type, f.reg].filter(Boolean).join(' '), f.rules].filter(Boolean).join(' · ')), esc(ago(p.updated || p.created)), 'pack:' + p.id); }).join('')}</ul>` : `<p class="none">${t('Every briefing pack you save shows up here, ready to reopen or duplicate for the next flight.', 'Alle briefingpakker du lagrer, vises her, klare til å åpnes igjen eller dupliseres til neste tur.')}</p>`, `<button type="button" class="lk" data-act="pack-new">${t('New briefing pack', 'Ny briefingpakke')}</button>`)}
        ${sec('#/routes', t('Routes', 'Ruter'), routes.length, routes.length ? `<ul>${routes.slice(0, 4).map(r => li('route.html?id=' + encodeURIComponent(r.id), esc(routeTitle(r)), (r.pts || []).length + ' ' + t('points', 'punkter') + (r.s && r.s.cr ? ' · ' + esc(r.s.cr) + ' ft' : ''), esc(ago(r.updated)), 'route:' + r.id)).join('')}</ul>` : `<p class="none">${t('Routes you draw in Route Explorer are saved here.', 'Ruter du tegner i Route Explorer, lagres her.')}</p>`, `<a class="lk" href="route.html">${t('Open Route Explorer', 'Åpne Route Explorer')}</a>`)}
        ${sec('profile.html', t('Training progress', 'Treningsprogresjon'), null, rank ? `<ul>${li('profile.html', esc(rank.name), rank.next ? esc((rank.next - rank.xp) + ' XP ' + t('to ', 'til ') + rank.nextName) : '', rank.xp + ' XP')}</ul><div class="bar" role="img" aria-label="${Math.round(rank.pct * 100)} %"><i style="width:${Math.round(rank.pct * 100)}%"></i></div><p class="none">${t('Your rank, learning path and achievements are on My page.', 'Rang, læringsløp og prestasjoner finner du på Min side.')}</p>` : `<p class="none">${t('Your rank, learning path and achievements are on My page.', 'Rang, læringsløp og prestasjoner finner du på Min side.')}</p>`, `<a class="lk" href="profile.html">${t('Open My page', 'Åpne Min side')}</a>`)}
      </div>
      ${custody()}`;
  }

  /* aircraft */
  function adoptable() {
    const out = []; const ac = liveOf('aircraft');
    S.fiac.forEach(f => { if (!ac.some(a => a.fiac === f.id) && !M.hideAdopt['fi:' + f.id]) out.push({ k: 'fi:' + f.id, name: f.name || f.type, type: f.type || f.name, reg: '', fiac: f.id, from: 'Flight Intelligence', n: Object.values(S.docs).filter(d => d.ac === f.id).length }); });
    S.prepAc.forEach(p => { if (p.reg && !ac.some(a => normReg(a.reg) === normReg(p.reg)) && !M.hideAdopt['pr:' + p.id]) out.push({ k: 'pr:' + p.id, name: [p.type, p.reg].filter(Boolean).join(' · '), type: p.type || '', reg: p.reg, fiac: '', from: t('Briefing pack', 'Briefingpakke'), n: 0 }); });
    return out;
  }
  function viewAircraftList() {
    const ac = aircraft(), sug = adoptable(), docs = docsAll(), notes = liveOf('note');
    main.innerHTML = `<div class="ws-h"><h2>${t('My aircraft', 'Mine fly')}</h2><div class="acts"><button type="button" class="btn pri" data-act="ac-new">${t('Add aircraft', 'Legg til fly')}</button></div>
        <p>${t('One page per aircraft: its manuals and checklists, your notes, key speeds and the briefing packs you have flown it on.', 'Én side per fly: manualer og sjekklister, notatene dine, viktige hastigheter og briefingpakkene du har fløyet det på.')}</p></div>
      ${ac.length ? `<div class="acgrid">${ac.map(a => `<a class="acc" href="#/aircraft/${esc(a.id)}">${a.isDefault ? `<span class="deflt">${t('Default for new briefing packs', 'Standard for nye briefingpakker')}</span>` : ''}<span class="reg">${esc(a.reg || a.type || '–')}</span><span class="ty">${esc([a.reg ? a.type : '', a.callsign].filter(Boolean).join(' · ') || ' ')}</span>
          <span class="ct"><span><b>${docs.filter(d => (d.acIds || []).includes(a.id)).length}</b> ${t('documents', 'dokumenter')}</span><span><b>${notes.filter(n => (n.links || []).some(l => l.t === 'aircraft' && l.id === a.id)).length}</b> ${t('notes', 'notater')}</span><span><b>${S.packs.filter(p => packAc(p) === a).length}</b> ${t('packs', 'pakker')}</span></span></a>`).join('')}</div>`
        : empty(t('<b>No aircraft yet.</b> Add the one you fly most. You can pick the type from a list or type your own, and the registration is optional.', '<b>Ingen fly ennå.</b> Legg til det du flyr mest. Du kan velge type fra en liste eller skrive din egen, og registreringen er valgfri.'), `<button type="button" class="btn pri" data-act="ac-new">${t('Add aircraft', 'Legg til fly')}</button>`)}
      ${sug.length ? `<h3 class="ws-sub">${t('Already in Birdbird', 'Finnes allerede i Birdbird')}</h3><ul class="rows">${sug.map(s => `<li><div class="t"><span class="n">${esc(s.name)}</span><small>${t('From ', 'Fra ') + esc(s.from)}${s.n ? ' · ' + plural(s.n, 'document', 'documents', 'dokument', 'dokumenter') : ''}</small></div><div class="r"><button type="button" class="btn sm" data-act="ac-adopt" data-id="${esc(s.k)}">${t('Add to my aircraft', 'Legg til i mine fly')}</button><button type="button" class="lk dim" data-act="ac-hide" data-id="${esc(s.k)}">${t('Hide', 'Skjul')}</button></div></li>`).join('')}</ul>` : ''}`;
  }
  function aircraftDlg(a) {
    const isNew = !a, cur = a || { typeKey: 'c172', type: '', reg: '', callsign: '', isDefault: !aircraft().length };
    return openDlg(`<h3 id="wsDlgH">${isNew ? t('Add aircraft', 'Legg til fly') : t('Edit aircraft', 'Endre fly')}</h3>
      <form id="acForm" novalidate>
        <div class="two"><div class="fld"><label for="acTypeKey">${t('Type', 'Type')}</label><select id="acTypeKey">${W.AIRCRAFT_TYPES.map(x => `<option value="${x.k}"${x.k === cur.typeKey ? ' selected' : ''}>${esc(x.name || t('Another type', 'En annen type'))}</option>`).join('')}</select></div>
        <div class="fld"><label for="acType">${t('Name of the type or variant', 'Navn på type eller variant')}</label><input id="acType" maxlength="60" value="${esc(cur.type)}" placeholder="${esc(t('e.g. Cessna 172S', 'f.eks. Cessna 172S'))}"></div></div>
        <div class="two"><div class="fld"><label for="acReg">${t('Registration (optional)', 'Registrering (valgfritt)')}</label><input id="acReg" maxlength="12" value="${esc(cur.reg)}" placeholder="LN-ABC" autocapitalize="characters" spellcheck="false"></div>
        <div class="fld"><label for="acCs">${t('Callsign (optional)', 'Kallesignal (valgfritt)')}</label><input id="acCs" maxlength="20" value="${esc(cur.callsign)}" spellcheck="false"></div></div>
        <div class="fld"><label class="ck"><input type="checkbox" id="acDef"${cur.isDefault ? ' checked' : ''}> ${t('Use this aircraft for new briefing packs', 'Bruk dette flyet for nye briefingpakker')}</label></div>
        <p class="err" id="acErr" role="alert" hidden></p>
        <div class="foot"><button type="button" class="btn" data-close>${t('Cancel', 'Avbryt')}</button><button type="submit" class="btn pri">${isNew ? t('Add aircraft', 'Legg til fly') : t('Save changes', 'Lagre endringer')}</button></div>
      </form>`, close => {
      const tk = el('acTypeKey'), ty = el('acType'); let auto = !cur.type || cur.type === W.typeOf(cur.typeKey).name;
      const fill = () => { if (auto) ty.value = W.typeOf(tk.value).name; };
      if (isNew) fill();
      tk.onchange = fill; ty.oninput = () => { auto = false; };
      el('acForm').onsubmit = async e => {
        e.preventDefault(); const type = ty.value.trim() || W.typeOf(tk.value).name;
        if (!type) { el('acErr').textContent = t('Type the name of the aircraft type.', 'Skriv navnet på flytypen.'); el('acErr').hidden = false; ty.focus(); return; }
        const f = { typeKey: tk.value, type, reg: el('acReg').value.trim().toUpperCase(), callsign: el('acCs').value.trim(), isDefault: el('acDef').checked };
        const out = isNew ? W.newAircraft(f) : W.patch(item(a.id), f);
        if (!isNew && a.typeKey !== f.typeKey && !(a.speeds || []).some(r => r.v)) out.speeds = W.newAircraft(f).speeds;
        const list = [out]; if (f.isDefault) aircraft().forEach(x => { if (x.id !== out.id && x.isDefault) list.push(W.patch(x, { isDefault: false })); });
        await commit(list); askPersist(); close(out.id);
      };
    });
  }
  function viewAircraft(id) {
    const a = item(id); if (!W.isLive(a)) return viewMissing('aircraft');
    visit('aircraft', id);
    const ty = W.typeOf(a.typeKey), docs = docsAll().filter(d => (d.acIds || []).includes(id)), notes = notesAll().filter(n => (n.links || []).some(l => l.t === 'aircraft' && l.id === id)), packs = packsAll().filter(p => packAc(p) === a);
    const free = docsAll().filter(d => !(d.acIds || []).includes(id));
    const byCat = W.DOC_CATS.map(c => [c, docs.filter(d => d.cat === c)]).filter(x => x[1].length);
    main.innerHTML = `<a class="ws-back" href="#/aircraft"><span aria-hidden="true">←</span> ${t('My aircraft', 'Mine fly')}</a>
      <div class="achead"><div><div class="reg">${esc(a.reg || a.type)}</div><div class="ty">${a.reg ? `<span>${esc(a.type)}</span>` : ''}${a.callsign ? `<span>${t('Callsign', 'Kallesignal')} <b>${esc(a.callsign)}</b></span>` : ''}${a.isDefault ? `<span class="deflt">${t('Default for new briefing packs', 'Standard for nye briefingpakker')}</span>` : ''}</div></div>
        <div class="acts">${ty.trainer ? `<a class="btn" href="${ty.trainer}">${esc(t.apply(null, TRAINER[ty.trainer]))}</a>` : ''}<button type="button" class="btn" data-act="pack-new" data-id="${esc(id)}">${t('New briefing pack', 'Ny briefingpakke')}</button><button type="button" class="btn" data-act="ac-edit" data-id="${esc(id)}">${t('Edit', 'Endre')}</button><button type="button" class="btn quiet" data-act="trash" data-id="${esc(id)}">${t('Move to trash', 'Flytt til papirkurv')}</button></div></div>
      <div class="ac2"><div>
        <h3 class="ws-sub"><span>${t('Documents', 'Dokumenter')} <span class="c">${docs.length}</span></span><button type="button" class="lk" data-act="doc-add" data-id="${esc(id)}">${t('Add documents', 'Legg til dokumenter')}</button></h3>
        <div class="prog" id="wsProg" hidden><span></span><div class="bar"><i></i></div></div>
        ${docs.length ? byCat.map(([c, ds]) => `<p class="ws-lbl">${esc(catName(c))}</p><ul class="rows" style="margin-bottom:14px">${ds.map(d => docRow(d)).join('')}</ul>`).join('') : empty(t('No documents linked to this aircraft yet. Start with the AFM or POH, then the checklist and your SOP.', 'Ingen dokumenter er koblet til dette flyet ennå. Start med AFM eller POH, så sjekklisten og SOP-en.'))}
        ${free.length ? `<div class="ws-filter" style="margin-top:10px"><select id="acLink" aria-label="${t('Link a document from your library', 'Koble et dokument fra biblioteket')}"><option value="">${t('Link a document from your library…', 'Koble et dokument fra biblioteket …')}</option>${free.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></div>` : ''}
        <h3 class="ws-sub"><span>${t('Notes', 'Notater')} <span class="c">${notes.length}</span></span><button type="button" class="lk" data-act="note-new" data-id="${esc(id)}">${t('New note', 'Nytt notat')}</button></h3>
        ${notes.length ? `<ul class="rows">${notes.map(n => `<li><div class="t"><a class="n" href="#/notes/${esc(n.id)}">${n.pinned ? '<i class="pin"></i>' : ''}${esc(noteTitle(n))}</a><small>${esc(W.noteText(n).slice(0, 120))}</small></div><div class="r"><span class="w">${esc(ago(n.updatedAt))}</span></div></li>`).join('')}</ul>` : empty(t('Notes you link to this aircraft show here.', 'Notater du kobler til dette flyet, vises her.'))}
        <h3 class="ws-sub"><span>${t('Briefing packs', 'Briefingpakker')} <span class="c">${packs.length}</span></span></h3>
        ${packs.length ? `<ul class="rows">${packs.map(p => packRow(p)).join('')}</ul>` : empty(t('Briefing packs with this registration show here.', 'Briefingpakker med denne registreringen vises her.'))}
      </div><div>
        <h3 class="ws-sub"><span>${t('Key speeds and limits', 'Viktige hastigheter og grenser')}</span><span class="savedmark" id="spSaved"></span></h3>
        <table class="speeds"><colgroup><col class="ck"><col class="cv"><col class="cu"><col class="cx"></colgroup><thead><tr><th>${t('Item', 'Punkt')}</th><th style="text-align:right">${t('Value', 'Verdi')}</th><th>${t('Unit', 'Enhet')}</th><th><span hidden>x</span></th></tr></thead><tbody id="spBody">${(a.speeds || []).map(speedRow).join('')}</tbody></table>
        <p class="speeds-note"><button type="button" class="lk" data-act="sp-add">${t('Add a row', 'Legg til en rad')}</button> · ${t('Enter the values from this aircraft’s own AFM or POH. Birdbird does not fill them in.', 'Skriv inn verdiene fra flyets egen AFM eller POH. Birdbird fyller dem ikke ut.')}</p>
        <h3 class="ws-sub"><span><label for="acNotes">${t('About this aircraft', 'Om dette flyet')}</label></span><span class="savedmark" id="anSaved"></span></h3>
        <textarea class="acnotes" id="acNotes" maxlength="4000" placeholder="${esc(t('Equipment, quirks, where the tow bar is kept…', 'Utstyr, særheter, hvor slepestangen ligger …'))}">${esc(a.notes)}</textarea>
      </div></div>`;
    const saveSp = () => { const rows = [...el('spBody').querySelectorAll('tr')].map(tr => ({ k: tr.querySelector('.k').value, v: tr.querySelector('.v').value, u: tr.querySelector('.u').value })); commit(W.patch(item(id), { speeds: rows.map(r => ({ k: r.k.slice(0, 24), v: r.v.slice(0, 16), u: r.u.slice(0, 10) })) })); el('spSaved').textContent = t('Saved', 'Lagret'); };
    el('spBody').addEventListener('input', saveSp);
    el('spBody').addEventListener('click', e => { const b = e.target.closest('[data-act="sp-del"]'); if (b) { b.closest('tr').remove(); saveSp(); } });
    main.querySelector('[data-act="sp-add"]').onclick = () => { el('spBody').insertAdjacentHTML('beforeend', speedRow({ k: '', v: '', u: 'KIAS' })); const r = el('spBody').lastElementChild; r.querySelector('.k').focus(); };
    el('acNotes').addEventListener('input', e => { commit(W.patch(item(id), { notes: e.target.value })); el('anSaved').textContent = t('Saved', 'Lagret'); });
    const lk = el('acLink'); if (lk) lk.onchange = async () => { const d = item(lk.value); if (!d) return; const e = W.patch(d, { acIds: W.uniq((d.acIds || []).concat(id)) }); await commit(e); await pushDocToFi(e); render(); };
  }
  const speedRow = r => `<tr><td><input class="k" value="${esc(r.k)}" maxlength="24" aria-label="${t('Item', 'Punkt')}"></td><td><input class="v" value="${esc(r.v)}" maxlength="16" inputmode="decimal" aria-label="${t('Value', 'Verdi')}"></td><td><input class="u" value="${esc(r.u)}" maxlength="10" aria-label="${t('Unit', 'Enhet')}"></td><td class="x"><button type="button" data-act="sp-del" aria-label="${t('Remove row', 'Fjern rad')}">✕</button></td></tr>`;

  /* documents */
  function docsFiltered() {
    const f = F.docs; let l = docsAll();
    if (f.cat) l = l.filter(d => d.cat === f.cat);
    if (f.ac) l = l.filter(d => f.ac === 'none' ? !(d.acIds || []).some(x => W.isLive(item(x))) : (d.acIds || []).includes(f.ac));
    if (f.q.trim()) { const tk = W.tokens(f.q); l = l.filter(d => { const h = W.fold([d.name, catName(d.cat), d.rev, (d.tags || []).join(' ')].join(' ')); return tk.every(x => h.includes(x)); }); }
    return l;
  }
  function viewDocs() {
    const all = docsAll(), ac = aircraft(), miss = all.filter(d => !onDevice(d.id)).length;
    main.innerHTML = `<div class="ws-h"><h2>${t('Documents', 'Dokumenter')}</h2><div class="acts"><button type="button" class="btn pri" data-act="doc-add">${t('Add documents', 'Legg til dokumenter')}</button></div>
        <p>${t('Your own manuals, checklists and charts. The files stay on this device and are never uploaded; the same documents are used by Flight Intelligence.', 'Dine egne manualer, sjekklister og kart. Filene blir på denne enheten og lastes aldri opp; de samme dokumentene brukes av Flight Intelligence.')}</p></div>
      ${miss ? `<div class="ws-remind info"><span>${t(`<b>${plural(miss, 'document is', 'documents are', '', '')} listed but the file is not on this device.</b> Your account keeps the list, not the files. Add each file again here, or import a backup file.`, `<b>${miss} ${miss === 1 ? 'dokument står' : 'dokumenter står'} i listen, men filen er ikke på denne enheten.</b> Kontoen din tar vare på listen, ikke filene. Legg til hver fil på nytt her, eller importer en sikkerhetskopi.`)}</span><a class="btn sm" href="#/storage">${t('Import backup', 'Importer sikkerhetskopi')}</a></div>` : ''}
      <div class="drop" id="wsDrop"><span>${t('Drop PDF, Word or text files here, or images of charts.', 'Slipp PDF-, Word- eller tekstfiler her, eller bilder av kart.')}</span><button type="button" class="btn sm" data-act="doc-add">${t('Choose files', 'Velg filer')}</button></div>
      <div class="prog" id="wsProg" hidden><span></span><div class="bar"><i></i></div></div>
      ${all.length ? `<div class="ws-filter"><div class="seg" id="dCat" role="group" aria-label="${t('Category', 'Kategori')}"></div></div>
      <div class="ws-filter"><input type="search" id="dQ" placeholder="${esc(t('Filter by name, tag or revision', 'Filtrer på navn, emneknagg eller revisjon'))}" aria-label="${t('Filter documents', 'Filtrer dokumenter')}" value="${esc(F.docs.q)}">
        ${ac.length ? `<select id="dAc" aria-label="${t('Aircraft', 'Fly')}"><option value="">${t('All aircraft', 'Alle fly')}</option>${ac.map(a => `<option value="${esc(a.id)}"${F.docs.ac === a.id ? ' selected' : ''}>${esc(acName(a))}</option>`).join('')}<option value="none"${F.docs.ac === 'none' ? ' selected' : ''}>${t('Not linked to an aircraft', 'Ikke koblet til et fly')}</option></select>` : ''}</div>
      <div id="dList"></div>` : empty(t('<b>No documents yet.</b> Start with the AFM or POH of the aircraft you fly, then your checklist and SOP. You can read them here, search inside them and link them to an aircraft.', '<b>Ingen dokumenter ennå.</b> Start med AFM eller POH for flyet du flyr, så sjekklisten og SOP-en. Du kan lese dem her, søke i dem og koble dem til et fly.'))}`;
    const draw = () => {
      const seg = el('dCat'); if (!seg) return;
      seg.innerHTML = [['', t('All', 'Alle'), all.length]].concat(W.DOC_CATS.map(c => [c, catName(c), all.filter(d => d.cat === c).length])).map(([c, n, k]) => `<button type="button" data-cat="${c}" class="${F.docs.cat === c ? 'on' : ''}" aria-pressed="${F.docs.cat === c}">${esc(n)} <span class="mono">${k}</span></button>`).join('');
      const l = docsFiltered();
      el('dList').innerHTML = l.length ? `<ul class="rows">${l.map(d => docRow(d, F.docs.q)).join('')}</ul>` : empty(t('No documents match this filter.', 'Ingen dokumenter passer med dette filteret.'), `<button type="button" class="lk" id="dClr">${t('Clear the filter', 'Fjern filteret')}</button>`);
      const c = el('dClr'); if (c) c.onclick = () => { F.docs = { q: '', cat: '', ac: '' }; render(); };
    };
    draw();
    const q = el('dQ'); if (q) q.oninput = () => { F.docs.q = q.value; draw(); };
    const s = el('dAc'); if (s) s.onchange = () => { F.docs.ac = s.value; draw(); };
    const seg = el('dCat'); if (seg) seg.onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { F.docs.cat = b.dataset.cat; draw(); } };
    const dz = el('wsDrop');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); if (ev === 'drop' && e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); }));
  }
  let viewerUrl = null, viewerPdf = null, viewerObs = null;
  function closeViewer() { if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; } if (viewerObs) { viewerObs.disconnect(); viewerObs = null; } if (viewerPdf) { try { viewerPdf.destroy(); } catch (e) {} viewerPdf = null; } }
  async function drawViewer(d, mode, page) {
    const box = el('docView'); if (!box) return; closeViewer();
    const doc = S.docs[d.id], pages = doc ? W.pagesFromChunks(doc.chunks) : [], blob = hasFile(d.id) ? await FI.getBlob(d.id) : null;
    if (!el('docView') || route().path !== 'documents/' + d.id) return;
    const isPdf = blob && (d.ext === 'pdf' || blob.type === 'application/pdf' || (doc && doc.blob)), isImg = blob && /^image\//.test(blob.type);
    const hasText = pages.length > 0;
    if (!mode) mode = isPdf || isImg ? 'file' : 'text';
    const bar = `<div class="vbar"><span>${isPdf && mode === 'file' ? `<span id="vCount">${d.pages || ''} ${t('pages', 'sider')}</span>` : hasText && mode === 'text' ? t('Text found in the document', 'Tekst funnet i dokumentet') : ''}</span>${(isPdf || isImg) && hasText ? `<div class="seg" role="group" aria-label="${t('View', 'Visning')}"><button type="button" data-vm="file" class="${mode === 'file' ? 'on' : ''}" aria-pressed="${mode === 'file'}">${isImg ? t('Image', 'Bilde') : 'PDF'}</button><button type="button" data-vm="text" class="${mode === 'text' ? 'on' : ''}" aria-pressed="${mode === 'text'}">${t('Text', 'Tekst')}</button></div>` : ''}</div>`;
    if (!doc) { box.innerHTML = `<div class="vmsg"><p><b>${t('The file is not on this device.', 'Filen er ikke på denne enheten.')}</b></p><p>${t('Your account keeps this document’s name, category, links and tags, but never the file itself. Add the file again on this device, or import a backup file that contains it.', 'Kontoen din tar vare på navn, kategori, koblinger og emneknagger for dette dokumentet, men aldri selve filen. Legg til filen på nytt på denne enheten, eller importer en sikkerhetskopi som inneholder den.')}</p><p><button type="button" class="btn pri" data-act="doc-file" data-id="${esc(d.id)}">${t('Add the file', 'Legg til filen')}</button></p></div>`; return; }
    if (mode === 'text' || !(isPdf || isImg)) {
      box.innerHTML = bar + (hasText ? `<div class="txt">${pages.map(p => `<h4 id="pg${p.p}">${t('Page', 'Side')} ${p.p}${p.s ? ' · ' + esc(p.s) : ''}</h4><p>${esc(p.t)}</p>`).join('')}</div>` : `<div class="vmsg"><p>${blob ? t('This file has no text Birdbird can show (it may be scanned or protected). The file itself is kept; download it to open it in another app.', 'Denne filen har ingen tekst Birdbird kan vise (den kan være skannet eller beskyttet). Selve filen er lagret; last den ned for å åpne den i en annen app.') : t('Only the text of this document was kept when it was added. Add the file again to read the original here.', 'Bare teksten i dette dokumentet ble tatt vare på da det ble lagt til. Legg til filen på nytt for å lese originalen her.')}</p></div>`);
    } else if (isImg) { viewerUrl = URL.createObjectURL(blob); box.innerHTML = bar + `<div class="pages"><img class="im" src="${viewerUrl}" alt="${esc(d.name)}"></div>`; }
    else {
      box.innerHTML = bar + `<div class="pages" id="vPages"><p class="vmsg">${t('Opening the PDF…', 'Åpner PDF-en …')}</p></div>`;
      try {
        const lib = await pdfjs(); const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
        if (!el('vPages') || route().path !== 'documents/' + d.id) { pdf.destroy(); return; }
        viewerPdf = pdf; const first = await pdf.getPage(1), v1 = first.getViewport({ scale: 1 }), host = el('vPages');
        host.innerHTML = Array.from({ length: pdf.numPages }, (_, i) => `<div class="pg" id="pg${i + 1}" data-p="${i + 1}" style="aspect-ratio:${v1.width}/${v1.height};max-width:${Math.round(v1.width * 1.6)}px"><span class="no">${i + 1}</span></div>`).join('');
        const live = [];
        const paint = async pg => {
          if (pg.dataset.done || pdf !== viewerPdf) return; pg.dataset.done = '1';
          try { const p = await pdf.getPage(+pg.dataset.p), w = pg.clientWidth || 600, vp0 = p.getViewport({ scale: 1 }), vp = p.getViewport({ scale: Math.min(3, w * Math.min(2, window.devicePixelRatio || 1) / vp0.width) });
            const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); pg.style.aspectRatio = vp0.width + '/' + vp0.height;
            await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; if (pdf !== viewerPdf) return; pg.insertBefore(c, pg.firstChild); live.push(pg);
            while (live.length > 14) { const old = live.shift(); const oc = old.querySelector('canvas'); if (oc) { oc.width = oc.height = 0; oc.remove(); } delete old.dataset.done; }
          } catch (e) { delete pg.dataset.done; }
        };
        viewerObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) paint(e.target); }), { rootMargin: '500px 0px' });
        host.querySelectorAll('.pg').forEach(pg => viewerObs.observe(pg));
      } catch (e) { const h = el('vPages'); if (h) h.innerHTML = `<p class="vmsg">${t('This PDF could not be opened here. Download it to open it in another app.', 'Denne PDF-en kunne ikke åpnes her. Last den ned for å åpne den i en annen app.')}${hasText ? ' ' + t('The text view still works.', 'Tekstvisningen fungerer fortsatt.') : ''}</p>`; }
    }
    box.querySelectorAll('[data-vm]').forEach(b => { b.onclick = () => drawViewer(d, b.dataset.vm); });
    if (page) setTimeout(() => { const g = el('pg' + page); if (g) g.scrollIntoView({ block: 'start' }); }, 60);
  }
  function viewDoc(id, q) {
    const d = item(id); if (!W.isLive(d)) return viewMissing('documents');
    visit('doc', id);
    const ac = aircraft(), here = onDevice(id), file = hasFile(id);
    main.innerHTML = `<a class="ws-back" href="#/documents"><span aria-hidden="true">←</span> ${t('Documents', 'Dokumenter')}</a>
      <h2 class="dochead" id="dHead">${esc(d.name)}</h2>
      <div class="doc2"><div class="docmeta">
        <div class="fld"><label for="dName">${t('Name', 'Navn')}</label><input id="dName" maxlength="160" value="${esc(d.name)}"></div>
        <div class="fld"><label for="dCat2">${t('Category', 'Kategori')}</label><select id="dCat2">${W.DOC_CATS.map(c => `<option value="${c}"${d.cat === c ? ' selected' : ''}>${esc(catName(c))}</option>`).join('')}</select></div>
        ${ac.length ? `<fieldset class="fld" id="dAcs"><legend>${t('Aircraft', 'Fly')}</legend>${ac.map(a => `<label class="ck"><input type="checkbox" value="${esc(a.id)}"${(d.acIds || []).includes(a.id) ? ' checked' : ''}> ${esc(acName(a))}</label>`).join('')}</fieldset>` : `<div class="fld"><span>${t('Aircraft', 'Fly')}</span><a class="lk" href="#/aircraft">${t('Add an aircraft to link this document to it', 'Legg til et fly for å koble dokumentet til det')}</a></div>`}
        <div class="fld"><label for="dTags">${t('Tags, separated by commas', 'Emneknagger, skilt med komma')}</label><input id="dTags" value="${esc((d.tags || []).join(', '))}" placeholder="${esc(t('e.g. rev 9, g1000', 'f.eks. rev 9, g1000'))}"></div>
        <div class="fld"><label for="dRev">${t('Revision or date, as printed on it', 'Revisjon eller dato, slik det står på dokumentet')}</label><input id="dRev" maxlength="40" value="${esc(d.rev || '')}"></div>
        <span class="savedmark" id="dSaved" role="status"></span>
        <div class="keptbox ${here ? '' : 'miss'}">${here ? `<b>${t('Kept on this device', 'Lagret på denne enheten')}</b>${d.size ? ' · ' + W.fmtBytes(d.size) : ''}<br>${t('The file is private to this browser and is never uploaded. Your account keeps only this page’s details so the library looks the same on your other devices.', 'Filen er privat for denne nettleseren og lastes aldri opp. Kontoen din tar bare vare på opplysningene på denne siden, slik at biblioteket ser likt ut på de andre enhetene dine.')}` : `<b>${t('File not on this device', 'Filen er ikke på denne enheten')}</b><br>${t('Add it again here, or import a backup file.', 'Legg den til på nytt her, eller importer en sikkerhetskopi.')}`}</div>
        <div class="chips">${file ? `<button type="button" class="btn sm" data-act="doc-dl" data-id="${esc(id)}">${t('Download the file', 'Last ned filen')}</button>` : ''}<button type="button" class="btn sm" data-act="doc-file" data-id="${esc(id)}">${here ? t('Replace the file', 'Bytt ut filen') : t('Add the file', 'Legg til filen')}</button>${here ? `<a class="btn sm" href="fi.html#docs">${t('Ask about it in Flight Intelligence', 'Spør om det i Flight Intelligence')}</a>` : ''}</div>
        ${here && ockCan(d) ? `<div class="fld"><span>${t('Your own checklist in the cockpit trainers', 'Din egen sjekkliste i cockpit-trenerne')}</span><div class="chips">${ockLinks(id)}</div><small style="color:var(--ink-3,#6b7680)">${t('The trainer shows it in its Procedures drawer and ticks items as you fly. It stays on this device.', 'Treneren viser den i prosedyreskuffen og krysser av punkter mens du flyr. Den blir på denne enheten.')}</small></div>` : ''}
        <button type="button" class="lk danger" data-act="trash" data-id="${esc(id)}" style="align-self:flex-start">${t('Move to trash', 'Flytt til papirkurv')}</button>
      </div><div class="viewer" id="docView"></div></div>`;
    const save = async f => { const e = W.patch(item(id), f); await commit(e); await pushDocToFi(e); el('dSaved').textContent = t('Saved', 'Lagret'); el('dHead').textContent = e.name; drawRail(); };
    el('dName').onchange = e => { const v = e.target.value.trim(); if (v) save({ name: v.slice(0, 160) }); else e.target.value = item(id).name; };
    el('dCat2').onchange = e => save({ cat: e.target.value });
    el('dTags').onchange = e => { const tg = W.cleanTags(e.target.value); e.target.value = tg.join(', '); save({ tags: tg }); };
    el('dRev').onchange = e => save({ rev: e.target.value.trim().slice(0, 40) });
    const acs = el('dAcs'); if (acs) acs.onchange = () => save({ acIds: [...acs.querySelectorAll('input:checked')].map(x => x.value) });
    drawViewer(d, null, +q.get('p') || 0);
  }

  /* briefing packs */
  function packsFiltered() {
    const f = F.packs; let l = packsAll(); const now = Date.now();
    if (f.ac) l = l.filter(p => { const a = packAc(p); return f.ac === 'none' ? !a : (a && a.id === f.ac); });
    if (f.when) l = l.filter(p => { const ts = (p.f && p.f.date && Date.parse(p.f.date)) || p.updated || p.created || 0; return f.when === '30' ? now - ts < 30 * W.DAY : f.when === 'year' ? new Date(ts).getFullYear() === new Date().getFullYear() : new Date(ts).getFullYear() < new Date().getFullYear(); });
    if (f.q.trim()) { const tk = W.tokens(f.q); l = l.filter(p => { const x = p.f || {}; const h = W.fold([packTitle(p), x.depapt, x.destapt, x.altn, x.reg, x.type, x.date, x.rules, x.route].join(' ')); return tk.every(y => h.includes(y)); }); }
    return l;
  }
  function viewPacks() {
    const ac = aircraft();
    main.innerHTML = `<div class="ws-h"><h2>${t('Briefing packs', 'Briefingpakker')}</h2><div class="acts"><button type="button" class="btn pri" data-act="pack-new">${t('New briefing pack', 'Ny briefingpakke')}</button></div>
        <p>${t('Every pack you have saved. Reopen one to fly it again, or duplicate it as the starting point for the next flight.', 'Alle pakkene du har lagret. Åpne en for å fly den igjen, eller dupliser den som utgangspunkt for neste tur.')}</p></div>
      ${S.packs.length ? `<div class="ws-filter"><input type="search" id="pQ" value="${esc(F.packs.q)}" placeholder="${esc(t('Filter by route, airport, registration or date', 'Filtrer på rute, flyplass, registrering eller dato'))}" aria-label="${t('Filter briefing packs', 'Filtrer briefingpakker')}">
        <select id="pAc" aria-label="${t('Aircraft', 'Fly')}"><option value="">${t('All aircraft', 'Alle fly')}</option>${ac.map(a => `<option value="${esc(a.id)}"${F.packs.ac === a.id ? ' selected' : ''}>${esc(acName(a))}</option>`).join('')}<option value="none"${F.packs.ac === 'none' ? ' selected' : ''}>${t('No aircraft from my list', 'Ingen fly fra listen min')}</option></select>
        <select id="pWhen" aria-label="${t('Date', 'Dato')}">${[['', t('Any date', 'Alle datoer')], ['30', t('Last 30 days', 'Siste 30 dager')], ['year', t('This year', 'I år')], ['old', t('Earlier years', 'Tidligere år')]].map(([v, n]) => `<option value="${v}"${F.packs.when === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div id="pList"></div>`
        : empty(t('<b>No briefing packs yet.</b> A briefing pack collects the route, weather, NOTAM, minima, fuel and mass and balance for one flight. Packs you save show up here.', '<b>Ingen briefingpakker ennå.</b> En briefingpakke samler rute, vær, NOTAM, minima, drivstoff og masse og balanse for én tur. Pakker du lagrer, vises her.'), `<button type="button" class="btn pri" data-act="pack-new">${t('New briefing pack', 'Ny briefingpakke')}</button>`)}`;
    const draw = () => { const b = el('pList'); if (!b) return; const l = packsFiltered(); b.innerHTML = l.length ? `<ul class="rows">${l.map(p => packRow(p, F.packs.q)).join('')}</ul>` : empty(t('No briefing packs match this filter.', 'Ingen briefingpakker passer med dette filteret.')); };
    draw();
    const q = el('pQ'); if (q) { q.oninput = () => { F.packs.q = q.value; draw(); }; el('pAc').onchange = e => { F.packs.ac = e.target.value; draw(); }; el('pWhen').onchange = e => { F.packs.when = e.target.value; draw(); }; }
  }
  async function newPack(acId) {
    const a = acId ? item(acId) : aircraft().find(x => x.isDefault);
    const p = { v2: 1, hide: ['check', 'crew', 'load', 'pilot', 'nav', 'air', 'risk', 'brief', 'charts'], id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: '', created: Date.now(), f: { 'rf.to': '1.25', 'rf.ld': '1.43', 'fu.unit': 'US gal', 'mb.dens': '3.03', rules: 'IFR', purpose: 'Training flight' }, sk: [] };
    if (W.isLive(a)) { if (a.type) p.f.type = a.type; if (a.reg) p.f.reg = a.reg; await NSTORE.put('prep', p); await commit(W.newPackMark(p.id, { acId: a.id })); location.href = 'prep.html?id=' + encodeURIComponent(p.id); }
    else location.href = 'prep.html';
  }
  async function dupPack(id) {
    const p = S.packs.find(x => x.id === id); if (!p) return;
    const c = JSON.parse(JSON.stringify(p)); c.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); c.created = Date.now(); if (c.f) { delete c.f.date; delete c.f.etd; }
    if ((c.title || '').trim()) c.title = c.title.trim() + ' ' + t('(copy)', '(kopi)');
    await NSTORE.put('prep', c); const m = packMark(id); if (m && m.acId) await commit(W.newPackMark(c.id, { acId: m.acId }));
    await loadStores(); render(); drawRail();
    toast(t('Duplicated. The copy has no date yet.', 'Duplisert. Kopien har ingen dato ennå.'), [t('Open the copy', 'Åpne kopien'), () => { location.href = 'prep.html?id=' + encodeURIComponent(c.id); }]);
  }

  /* notes */
  function notesFiltered() { const f = F.notes; let l = notesAll(); if (f.tag) l = l.filter(n => (n.tags || []).includes(f.tag)); if (f.q.trim()) { const tk = W.tokens(f.q); l = l.filter(n => { const h = W.fold(noteTitle(n) + ' ' + W.noteText(n) + ' ' + (n.tags || []).join(' ')); return tk.every(x => h.includes(x)); }); } return l; }
  /* pen notebooks open on the desk */
  const SOON = () => notebooksAll().map(n => { const pg = (n.pages || []).length; return `<a class="nt nbk" href="#/notebook/${esc(n.id)}"><svg viewBox="0 0 44 22" aria-hidden="true"><path d="M2 16c5-9 8-12 10-9s-3 10 1 10 6-12 10-11-2 11 2 11 5-7 8-8 5 3 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><b>${esc(n.title || t('Notebook', 'Notatbok'))}</b><p>${t('Notebook', 'Notatbok')} · ${plural(pg, 'page', 'pages', 'side', 'sider')}</p><span class="ft"><span></span><span>${esc(ago(n.updatedAt))}</span></span></a>`; }).join('')
    + `<div class="nt soon"><svg viewBox="0 0 44 22" aria-hidden="true"><path d="M2 16c5-9 8-12 10-9s-3 10 1 10 6-12 10-11-2 11 2 11 5-7 8-8 5 3 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><b>${t('Write with a pen', 'Skriv med penn')}</b><p>${t('A notebook on the desk: grid, lined, dots or a clearance, approach briefing or kneeboard page. Works with Apple Pencil, a finger or a mouse.', 'En notatbok på arbeidsflaten: rutenett, linjer, prikker eller en klarerings-, innflygingsbrief- eller kneebrettside. Fungerer med Apple Pencil, finger eller mus.')}</p><button type="button" class="btn sm" data-act="nb-new" style="align-self:flex-start">${t('New notebook', 'Ny notatbok')}</button></div>`;
  function viewNotes() {
    const all = liveOf('note'), tags = W.uniq(all.flatMap(n => n.tags || [])).sort();
    if (F.notes.tag && !tags.includes(F.notes.tag)) F.notes.tag = '';
    main.innerHTML = `<div class="ws-h"><h2>${t('Notes', 'Notater')}</h2><div class="acts"><button type="button" class="btn pri" data-act="note-new">${t('New note', 'Nytt notat')}</button></div>
        <p>${t('Saved on every keystroke, with earlier versions kept. Link a note to an aircraft, a document, a briefing pack or a lab to find it from there.', 'Lagres for hvert tastetrykk, og tidligere versjoner tas vare på. Koble et notat til et fly, et dokument, en briefingpakke eller en lab for å finne det derfra.')}</p></div>
      ${all.length ? `<div class="ws-filter"><input type="search" id="nQ" value="${esc(F.notes.q)}" placeholder="${esc(t('Filter notes', 'Filtrer notater'))}" aria-label="${t('Filter notes', 'Filtrer notater')}">${tags.length ? `<select id="nTag" aria-label="${t('Tag', 'Emneknagg')}"><option value="">${t('All tags', 'Alle emneknagger')}</option>${tags.map(x => `<option${F.notes.tag === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}</div>` : ''}
      <div class="notegrid" id="nList"></div>`;
    const draw = () => { const l = notesFiltered(); el('nList').innerHTML = (l.length ? l.map(noteCard).join('') : all.length ? `<div class="nt soon" style="border-style:solid"><b>${t('No notes match this filter.', 'Ingen notater passer med dette filteret.')}</b></div>` : `<div class="nt soon" style="border-style:solid"><b>${t('No notes yet', 'Ingen notater ennå')}</b><p>${t('Start one for your next lesson or checkride.', 'Start ett til neste time eller kontroll.')}</p><button type="button" class="btn pri sm" data-act="note-new" style="align-self:flex-start">${t('New note', 'Nytt notat')}</button></div>`) + SOON(); };
    draw();
    const q = el('nQ'); if (q) q.oninput = () => { F.notes.q = q.value; draw(); };
    const s = el('nTag'); if (s) s.onchange = () => { F.notes.tag = s.value; draw(); };
  }
  async function newNote(acId) { const n = W.newNote({ links: acId ? [{ t: 'aircraft', id: acId }] : [] }); await commit(n); askPersist(); go('notes/' + n.id); }
  function linkLabel(l) {
    if (l.t === 'aircraft') { const a = item(l.id); return W.isLive(a) ? { n: acName(a), h: '#/aircraft/' + a.id } : null; }
    if (l.t === 'doc') { const d = item(l.id); return W.isLive(d) ? { n: d.name, h: '#/documents/' + d.id } : null; }
    if (l.t === 'pack') { const p = S.packs.find(x => x.id === l.id); return p ? { n: packTitle(p), h: 'prep.html?id=' + encodeURIComponent(p.id) } : null; }
    if (l.t === 'lab') { const x = (LAB.FLAT || []).find(y => y.k === l.id); return x ? { n: t(x.en, x.no), h: x.f } : null; }
    return null;
  }
  /* phase 2 registers more formats here (see the header of this file) */
  const noteFormats = { text: { label: () => t('Typed note', 'Skrevet notat') } };
  function viewNote(id) {
    let n = item(id); if (!W.isLive(n) || n.kind !== 'note') return viewMissing('notes');
    visit('note', id);
    const fmtBtn = (cmd, label, html, arg) => `<button type="button" data-cmd="${cmd}"${arg ? ` data-arg="${arg}"` : ''} title="${esc(label)}" aria-label="${esc(label)}">${html}</button>`;
    main.innerHTML = `<a class="ws-back" href="#/notes"><span aria-hidden="true">←</span> ${t('Notes', 'Notater')}</a>
      <div class="note2"><div class="editor">
        <input class="ttl" id="nTitle" maxlength="140" value="${esc(n.title)}" placeholder="${esc(t('Title', 'Tittel'))}" aria-label="${t('Title', 'Tittel')}">
        <div class="tb" role="toolbar" aria-label="${t('Formatting', 'Formatering')}">${fmtBtn('bold', t('Bold', 'Fet'), '<b>B</b>')}${fmtBtn('italic', t('Italic', 'Kursiv'), '<i>I</i>')}${fmtBtn('mark', t('Highlight', 'Uthev'), '<mark style="background:#FBEFB5;padding:0 3px">' + t('Mark', 'Uthev') + '</mark>')}<span class="sep"></span>${fmtBtn('formatBlock', t('Heading', 'Overskrift'), t('Heading', 'Overskrift'), 'h3')}${fmtBtn('formatBlock', t('Body text', 'Brødtekst'), t('Text', 'Tekst'), 'div')}<span class="sep"></span>${fmtBtn('insertUnorderedList', t('Bulleted list', 'Punktliste'), '• ' + t('List', 'Liste'))}${fmtBtn('insertOrderedList', t('Numbered list', 'Nummerert liste'), '1. ' + t('List', 'Liste'))}</div>
        <div class="bd" id="nBody" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${t('Note text', 'Notattekst')}" data-ph="${esc(t('Write here. It is saved as you type.', 'Skriv her. Det lagres mens du skriver.'))}"></div>
        <div class="sf"><span id="nSaved" role="status"></span><span id="nCount"></span></div>
      </div>
      <aside class="noteside" id="nSide"></aside></div>`;
    const body = el('nBody'), title = el('nTitle'); body.innerHTML = n.body;
    const stat = saved => { el('nCount').textContent = plural(W.wordCount(n), 'word', 'words', 'ord', 'ord'); el('nSaved').innerHTML = saved ? `<span class="ok">${t('Saved', 'Lagret')}</span> ${clock(n.updatedAt)}` : t('Last changed ', 'Sist endret ') + esc(ago(n.updatedAt)); };
    const save = f => { const before = (n.versions || []).length; n = W.editNote(item(id) || n, f); commit(n); stat(true); if ((n.versions || []).length !== before) side(); };
    body.addEventListener('input', () => save({ body: body.innerHTML }));
    title.addEventListener('input', () => save({ title: title.value }));
    body.addEventListener('paste', e => { e.preventDefault(); const tx = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, tx); });
    body.addEventListener('keydown', e => { if (e.key === '/') e.stopPropagation(); });   // the site search listens for "/" on the page
    main.querySelector('.tb').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    main.querySelector('.tb').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; body.focus();
      if (b.dataset.cmd === 'mark') { const s = window.getSelection(); if (s.rangeCount && !s.isCollapsed && body.contains(s.anchorNode)) { const r = s.getRangeAt(0), inMark = (s.anchorNode.parentElement || body).closest('mark'); try { if (inMark && body.contains(inMark)) inMark.replaceWith(...inMark.childNodes); else r.surroundContents(document.createElement('mark')); } catch (er) { toast(t('Highlight one paragraph at a time.', 'Uthev ett avsnitt om gangen.')); } } }
      else document.execCommand(b.dataset.cmd, false, b.dataset.arg || null);
      save({ body: body.innerHTML });
    });
    function side() {
      n = item(id) || n; const links = (n.links || []).map(l => ({ l, v: linkLabel(l) })).filter(x => x.v), vs = (n.versions || []).slice().reverse();
      const have = new Set((n.links || []).map(l => l.t + ':' + l.id));
      const og = (label, tp, list) => { const o = list.filter(x => !have.has(tp + ':' + x[0])); return o.length ? `<optgroup label="${esc(label)}">${o.map(x => `<option value="${tp}:${esc(x[0])}">${esc(x[1])}</option>`).join('')}</optgroup>` : ''; };
      el('nSide').innerHTML = `
        <div class="fld"><span>${t('Linked to', 'Koblet til')}</span>${links.length ? `<div class="chips">${links.map(x => `<span class="chip"><a href="${x.v.h}" style="color:inherit;text-decoration:none;min-width:0;display:flex"><span>${esc(x.v.n)}</span></a><button type="button" data-unlink="${esc(x.l.t + ':' + x.l.id)}" aria-label="${t('Remove link to', 'Fjern kobling til')} ${esc(x.v.n)}">✕</button></span>`).join('')}</div>` : ''}
          <select id="nLink" aria-label="${t('Link this note', 'Koble dette notatet')}"><option value="">${t('Link to an aircraft, document, pack or lab…', 'Koble til et fly, dokument, pakke eller lab …')}</option>${og(t('Aircraft', 'Fly'), 'aircraft', aircraft().map(a => [a.id, acName(a)]))}${og(t('Documents', 'Dokumenter'), 'doc', docsAll().map(d => [d.id, d.name]))}${og(t('Briefing packs', 'Briefingpakker'), 'pack', packsAll().map(p => [p.id, packTitle(p)]))}${og('Virtual Labs', 'lab', (LAB.FLAT || []).map(x => [x.k, t(x.en, x.no)]))}</select></div>
        <div class="fld"><label for="nTags">${t('Tags, separated by commas', 'Emneknagger, skilt med komma')}</label><input id="nTags" value="${esc((n.tags || []).join(', '))}" placeholder="${esc(t('e.g. ifr, checkride', 'f.eks. ifr, kontroll'))}"></div>
        <div class="fld"><label class="ck"><input type="checkbox" id="nPin"${n.pinned ? ' checked' : ''}> ${t('Pin to the top of my notes', 'Fest øverst i notatene mine')}</label></div>
        <div class="fld"><span>${t('Version history', 'Versjonshistorikk')}${vs.length ? ' · ' + vs.length : ''}</span>${vs.length ? `<ul class="vers">${vs.map(v => `<li><span><span class="w">${esc(dayClock(v.at))}</span><span class="sn">${esc((v.title ? v.title + ' – ' : '') + W.htmlToText(v.body).replace(/\s+/g, ' ').slice(0, 80)) || t('Empty', 'Tom')}</span><small>${v.conflict ? `<span class="cf">${t('From another device', 'Fra en annen enhet')}</span> · ` : ''}${plural(W.wordCount(v), 'word', 'words', 'ord', 'ord')}</small></span><button type="button" class="lk" data-ver="${v.at}">${t('View', 'Vis')}</button></li>`).join('')}</ul>` : `<p class="note">${t('Earlier versions appear here as you keep writing. The last 20 are kept.', 'Tidligere versjoner dukker opp her etter hvert som du skriver. De siste 20 tas vare på.')}</p>`}</div>
        <button type="button" class="lk danger" data-act="trash" data-id="${esc(id)}" style="align-self:flex-start">${t('Move to trash', 'Flytt til papirkurv')}</button>`;
      el('nLink').onchange = e => { const v = e.target.value; if (!v) return; const i = v.indexOf(':'); save({ links: (n.links || []).concat({ t: v.slice(0, i), id: v.slice(i + 1) }) }); side(); };
      el('nTags').onchange = e => { const tg = W.cleanTags(e.target.value); e.target.value = tg.join(', '); save({ tags: tg }); };
      el('nPin').onchange = e => save({ pinned: e.target.checked });
      el('nSide').querySelectorAll('[data-unlink]').forEach(b => { b.onclick = () => { save({ links: (n.links || []).filter(l => l.t + ':' + l.id !== b.dataset.unlink) }); side(); }; });
      el('nSide').querySelectorAll('[data-ver]').forEach(b => { b.onclick = async () => {
        const v = (n.versions || []).find(x => x.at === +b.dataset.ver); if (!v) return;
        const ok = await openDlg(`<h3 id="wsDlgH">${t('Version from ', 'Versjon fra ')}${esc(dayClock(v.at))}</h3>${v.conflict ? `<p>${t('This text was written on another device at the same time as the current one.', 'Denne teksten ble skrevet på en annen enhet samtidig med den nåværende.')}</p>` : ''}<p><b>${esc(v.title || t('Untitled note', 'Notat uten tittel'))}</b></p><div class="verprev">${W.sanitizeHtml(v.body) || '<i>' + t('Empty', 'Tom') + '</i>'}</div><p style="margin-top:12px">${t('Restoring keeps the current text as a new version, so you can always go back.', 'Når du gjenoppretter, tas den nåværende teksten vare på som en ny versjon, så du kan alltid gå tilbake.')}</p><div class="foot"><button type="button" class="btn" data-close>${t('Close', 'Lukk')}</button><button type="button" class="btn pri" id="wsDlgOk">${t('Restore this version', 'Gjenopprett denne versjonen')}</button></div>`, close => { el('wsDlgOk').onclick = () => close(true); });
        if (ok) { n = W.restoreVersion(item(id), v.at); await commit(n); render(); toast(t('Version restored.', 'Versjonen er gjenopprettet.')); }
      }; });
    }
    stat(false); side();
    if (!n.title && !n.body) title.focus();
  }

  /* routes, trash, storage, search */
  function viewRoutes() {
    const l = S.routes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    main.innerHTML = `<div class="ws-h"><h2>${t('Routes', 'Ruter')}</h2><div class="acts"><a class="btn pri" href="route.html">${t('Open Route Explorer', 'Åpne Route Explorer')}</a></div><p>${t('Routes you have drawn and saved in Route Explorer.', 'Ruter du har tegnet og lagret i Route Explorer.')}</p></div>
      ${l.length ? `<ul class="rows">${l.map(routeRow).join('')}</ul>` : empty(t('<b>No saved routes yet.</b> Draw a route in Route Explorer and it is saved here automatically.', '<b>Ingen lagrede ruter ennå.</b> Tegn en rute i Route Explorer, så lagres den her automatisk.'))}`;
  }
  const itemName = it => it.kind === 'aircraft' ? acName(it) : it.kind === 'doc' ? it.name : it.kind === 'note' ? noteTitle(it) : it.kind === 'desk' ? (it.name || t('Desk', 'Arbeidsflate')) : it.kind === 'notebook' ? (it.title || t('Notebook', 'Notatbok')) : it.id;
  function viewTrash() {
    const l = W.trashed(S.items).filter(x => x.kind !== 'pack');
    main.innerHTML = `<div class="ws-h"><h2>${t('Trash', 'Papirkurv')}</h2>${l.length ? `<div class="acts"><button type="button" class="btn danger" data-act="trash-empty">${t('Empty the trash', 'Tøm papirkurven')}</button></div>` : ''}<p>${t('Deleted aircraft, documents, notes and desks stay here for 30 days and can be restored with everything they had. After that they are removed for good.', 'Slettede fly, dokumenter, notater og arbeidsflater blir liggende her i 30 dager og kan gjenopprettes med alt de hadde. Etter det fjernes de for godt.')}</p></div>
      ${l.length ? `<ul class="rows">${l.map(it => { const d = W.trashDaysLeft(it); return `<li><div class="t"><span class="n">${esc(itemName(it))}</span><small>${esc(kindName(it.kind))} · ${t('deleted ', 'slettet ')}${esc(ago(it.deletedAt))} · ${d <= 1 ? t('removed for good tomorrow', 'fjernes for godt i morgen') : t(`removed for good in ${d} days`, `fjernes for godt om ${d} dager`)}</small></div><div class="r"><button type="button" class="btn sm" data-act="restore" data-id="${esc(it.id)}">${t('Restore', 'Gjenopprett')}</button><button type="button" class="lk danger" data-act="purge" data-id="${esc(it.id)}">${t('Delete for good', 'Slett for godt')}</button></div></li>`; }).join('')}</ul>` : empty(t('The trash is empty.', 'Papirkurven er tom.'))}`;
  }
  function viewStorage() {
    const u = user(), files = localOnlyFiles(), bytes = files.reduce((a, d) => a + ((item(d.id) || {}).size || 0), 0), pct = S.est.quota ? Math.min(100, S.est.usage / S.est.quota * 100) : 0;
    const Y = s => `<span class="y">${s}</span>`, N = s => `<span class="n">${s}</span>`;
    const yes = t('Yes', 'Ja'), acc = u ? Y(yes) : N(t('When you sign in', 'Når du logger inn')), never = N(t('Never', 'Aldri'));
    const H = [t('On this device', 'På denne enheten'), t('In your account', 'På kontoen din'), t('In a backup file', 'I en sikkerhetskopi')];
    const row = (h, a, b, c) => `<tr><th scope="row">${h}</th><td data-h="${esc(H[0])}">${a}</td><td data-h="${esc(H[1])}">${b}</td><td data-h="${esc(H[2])}">${c}</td></tr>`;
    const full = M.sync.full, fl = full ? Object.values(full).flatMap(x => x.leftOut).map(item).filter(Boolean) : [], trimmed = full ? Object.values(full).reduce((a, x) => a + (x.trimmed || 0), 0) : 0;
    main.innerHTML = `<div class="ws-h"><h2>${t('Storage and backup', 'Lagring og sikkerhetskopi')}</h2><p>${t('Where each part of your workspace is kept, and how to make sure none of it is lost.', 'Hvor hver del av arbeidsområdet er lagret, og hvordan du sørger for at ingenting går tapt.')}</p></div>
      <table class="kepttable"><thead><tr><th scope="col">${t('What', 'Hva')}</th><th scope="col">${H[0]}</th><th scope="col">${H[1]}</th><th scope="col">${H[2]}</th></tr></thead><tbody>
        ${row(t('Aircraft, notes and their version history', 'Fly, notater og versjonshistorikken deres'), Y(yes), acc, Y(yes))}
        ${row(t('Document list: name, category, links, tags', 'Dokumentlisten: navn, kategori, koblinger, emneknagger'), Y(yes), acc, Y(yes))}
        ${row(t('Document files (PDF, Word, text, images)', 'Dokumentfiler (PDF, Word, tekst, bilder)'), Y(yes), never + '. ' + t('They may be copyrighted company manuals, so they stay private to you.', 'De kan være opphavsrettsbeskyttede selskapsmanualer, så de forblir private for deg.'), Y(yes))}
        ${row(t('Briefing packs and routes', 'Briefingpakker og ruter'), Y(yes), acc, Y(yes))}
        ${row(t('Pen notebooks and ink on PDFs', 'Notatbøker og blekk på PDF-er'), Y(yes), u ? Y(t('When they fit the free account space', 'Når de får plass i den gratis kontoplassen')) : acc, Y(yes))}
        ${row(t('Trash', 'Papirkurv'), Y(t('30 days', '30 dager')), acc, t('Listed, without files', 'Oppført, uten filer'))}
      </tbody></table>
      ${full ? `<div class="ws-remind" style="margin:20px 0 0"><span><b>${t('Your account space for notes is full.', 'Kontoplassen for notater er full.')}</b> ${trimmed ? t(`The account copy holds fewer old versions (${trimmed} left out); this device keeps them all. `, `Kontokopien har færre gamle versjoner (${trimmed} utelatt); denne enheten har alle. `) : ''}${fl.length ? t('These stay on this device only until you shorten or delete notes: ', 'Disse blir bare på denne enheten til du forkorter eller sletter notater: ') + fl.map(x => `<a href="#/notes/${esc(x.id)}">${esc(itemName(x))}</a>`).join(', ') + '.' : ''} ${t('A backup file always holds everything.', 'En sikkerhetskopi inneholder alltid alt.')}</span></div>` : ''}
      <div class="stor2">
        <div class="box"><h3>${t('This device', 'Denne enheten')}</h3>
          <p>${plural(files.length, 'document file', 'document files', 'dokumentfil', 'dokumentfiler')} · <span class="mono">${W.fmtBytes(bytes)}</span>${S.est.quota ? ` · ${t('Birdbird uses', 'Birdbird bruker')} <span class="mono">${W.fmtBytes(S.est.usage)}</span> ${t('of about', 'av omtrent')} <span class="mono">${W.fmtBytes(S.est.quota)}</span> ${t('available in this browser', 'tilgjengelig i denne nettleseren')}` : ''}</p>
          ${S.est.quota ? `<div class="meter" role="img" aria-label="${pct.toFixed(0)} %"><i style="width:${pct.toFixed(1)}%"></i></div>` : ''}
          <p>${S.est.persisted === true ? `<b>${t('Protected.', 'Beskyttet.')}</b> ${t('The browser has agreed not to clear this storage on its own.', 'Nettleseren har godtatt å ikke tømme dette lageret på egen hånd.')}` : `<b>${t('Not protected yet.', 'Ikke beskyttet ennå.')}</b> ${t('A browser may clear a site’s storage when the device is low on space, and Safari on iPhone and iPad can do so when a site has not been opened for a while. Adding Birdbird to the Home Screen helps, signing in protects aircraft and notes, and a backup file protects the document files.', 'En nettleser kan tømme lageret til et nettsted når enheten har lite plass, og Safari på iPhone og iPad kan gjøre det når et nettsted ikke har vært åpnet på en stund. Det hjelper å legge Birdbird til på Hjem-skjermen, innlogging beskytter fly og notater, og en sikkerhetskopi beskytter dokumentfilene.')}`}</p>
          ${S.est.persisted !== true && navigator.storage && navigator.storage.persist ? `<button type="button" class="btn sm" data-act="persist">${t('Ask the browser to protect this storage', 'Be nettleseren beskytte dette lageret')}</button>` : ''}</div>
        <div class="box"><h3>${t('Your account', 'Kontoen din')}</h3>
          ${u ? `<p>${t('Signed in', 'Logget inn')}${u.name ? ' ' + t('as ', 'som ') + '<b>' + esc(u.name) + '</b>' : ''}. ${M.sync.last ? t('Last synced ', 'Sist synkronisert ') + esc(ago(M.sync.last)) + '.' : ''} ${t('Changes sync a few seconds after you make them. If two devices change the same note, both texts are kept.', 'Endringer synkroniseres noen sekunder etter at du gjør dem. Hvis to enheter endrer samme notat, tas begge tekstene vare på.')}</p><div class="row"><button type="button" class="btn sm" data-act="sync">${t('Sync now', 'Synkroniser nå')}</button><a class="btn sm" href="profile.html#account">${t('Account settings', 'Kontoinnstillinger')}</a></div>`
            : `<p>${t('Not signed in. Everything works and is saved on this device. With a free account your aircraft, notes and document list are also kept in your account and appear on your other devices.', 'Ikke logget inn. Alt fungerer og lagres på denne enheten. Med en gratis konto lagres også fly, notater og dokumentlisten på kontoen din og vises på de andre enhetene dine.')}</p><a class="btn sm pri" href="profile.html#account">${t('Sign in or create an account', 'Logg inn eller lag en konto')}</a>`}</div>
        <div class="box"><h3>${t('Backup file', 'Sikkerhetskopi')}</h3>
          <p>${t('One .zip file with your aircraft, notes, briefing packs, routes and every document file. Keep it in your own cloud drive or on a USB stick.', 'Én .zip-fil med fly, notater, briefingpakker, ruter og alle dokumentfilene. Legg den i din egen skylagring eller på en minnepinne.')} ${M.backupAt ? t('Last backup ', 'Siste sikkerhetskopi ') + '<b>' + esc(dayClock(M.backupAt)) + '</b>.' : `<b>${t('No backup made yet.', 'Ingen sikkerhetskopi ennå.')}</b>`}</p>
          <div class="row"><button type="button" class="btn sm pri" data-act="export">${t('Export everything', 'Eksporter alt')}</button><button type="button" class="btn sm" data-act="import">${t('Import backup', 'Importer sikkerhetskopi')}</button></div>
          <p class="note" id="bkNote" role="status">${t('Importing adds what is missing and keeps the newest copy of each item. Nothing on this device is removed.', 'Import legger til det som mangler og beholder den nyeste kopien av hvert element. Ingenting på denne enheten fjernes.')}</p></div>
        <div class="box danger"><h3>${t('Delete everything', 'Slett alt')}</h3>
          <p>${t('Removes every aircraft, note and document in My Workspace from this device', 'Fjerner alle fly, notater og dokumenter i Mitt arbeidsområde fra denne enheten')}${u ? t(' and from your account', ' og fra kontoen din') : ''}. ${t('Briefing packs, routes and training progress are not touched; you manage those on My page.', 'Briefingpakker, ruter og treningsprogresjon røres ikke; dem styrer du på Min side.')}</p>
          <button type="button" class="btn sm danger" data-act="wipe">${t('Delete everything…', 'Slett alt …')}</button></div>
      </div>`;
  }
  function viewSearch(q) {
    const res = findAll(q), groups = [['aircraft', t('Aircraft', 'Fly')], ['doc', t('Documents', 'Dokumenter')], ['note', t('Notes', 'Notater')], ['notebook', t('Notebooks', 'Notatbøker')], ['pack', t('Briefing packs', 'Briefingpakker')], ['route', t('Routes', 'Ruter')]];
    const inside = docsAll().map(d => { const doc = S.docs[d.id]; const h = doc ? W.searchChunks(doc.chunks, q) : null; return h ? { d, h } : null; }).filter(Boolean).sort((a, b) => b.h.hits - a.h.hits).slice(0, 12);
    const n = res.length + inside.length;
    const row = r => { const e = r.entry, ext = /\.html/.test(e.href); return `<li><div class="t"><a class="n" href="${e.href}"${ext ? ` data-visit="${e.t}:${esc(e.id)}"` : ''}>${mark(e.title, q)}</a><small class="wrap">${r.snippet ? mark(r.snippet, q) : mark((e.sub || '').trim(), q)}</small></div><div class="r">${tagChips(e.tags)}<span class="w">${esc(ago(e.at))}</span></div></li>`; };
    main.innerHTML = `<div class="ws-h"><h2>${n ? plural(n, 'result', 'results', 'treff', 'treff') + t(' for “', ' for «') + esc(q) + t('”', '»') : t('Nothing found for “', 'Ingen treff for «') + esc(q) + t('”', '»')}</h2><div class="acts"><button type="button" class="btn sm" data-act="search-clear">${t('Clear the search', 'Tøm søket')}</button></div></div>
      <div class="ws-res">${n ? groups.map(([k, name]) => { const l = res.filter(r => r.entry.t === k); return l.length ? `<h3>${esc(name)}</h3><ul class="rows">${l.map(row).join('')}</ul>` : ''; }).join('') + (inside.length ? `<h3>${t('Inside your documents', 'Inne i dokumentene dine')}</h3><ul class="rows">${inside.map(x => `<li><div class="t"><a class="n" href="#/documents/${esc(x.d.id)}?p=${x.h.p}">${esc(x.d.name)} <span class="mono" style="font-weight:400;color:var(--ink-2)">· ${t('page', 'side')} ${x.h.p}</span></a><small class="wrap">${mark(x.h.snippet, q)}</small></div><div class="r"><span class="where">${esc(catName(x.d.cat))}</span></div></li>`).join('')}</ul>` : '')
        : empty(t('The search looks in your aircraft, document names and text, notes, briefing packs and routes. Try fewer or shorter words.', 'Søket ser i flyene dine, dokumentnavn og -tekst, notater, briefingpakker og ruter. Prøv færre eller kortere ord.'))}</div>`;
  }
  /* ---------- the map: the workspace as a constellation (graph in wsgraph.js, drawing in wsmap.js) ---------- */
  const GW = window.WSGRAPH;
  const mapNames = { name: (k, o) => k === 'aircraft' ? (o.reg || acName(o)) : k === 'doc' ? o.name : k === 'note' ? noteTitle(o) : k === 'notebook' ? (o.title || t('Notebook', 'Notatbok')) : k === 'pack' ? packTitle(o) : k === 'route' ? routeTitle(o) : k === 'desk' ? (o.name || t('Desk', 'Arbeidsflate')) : '',
    pageName: (dl, p) => dl + ' · ' + t('p. ', 's. ') + p };
  function mapGraph() {
    if (!GW) return null;
    return GW.buildGraph({ items: S.items, packs: S.packs, routes: S.routes }, Object.assign({ packAc: p => { const a = packAc(p); return a ? a.id : ''; }, pages: false, desks: false }, mapNames));
  }
  /* the map shown everywhere: only your own items, each aircraft a soft cloud of its own; with nothing of your own yet the
     small example (sample). mode: sample | own */
  let sampleG = null;
  function mapAny() {
    const own = mapGraph(); if (!own) return null;
    if (own.own) return { g: own, sample: false, mode: 'own' };
    if (!sampleG || sampleG.lang !== LAB.lang) sampleG = { lang: LAB.lang, g: GW.buildGraph(GW.sampleInput(t), Object.assign({ pages: false, desks: false }, mapNames)) };
    return { g: sampleG.g, sample: true, mode: 'sample' };
  }
  function mapOpen(n, beside) {
    const D = window.WSDESK; if (!D) return;
    if (n.k === 'desk') D.switchDesk(n.r);
    else if (n.k === 'page') D.openItem('doc', n.doc, { beside, st: Object.assign({}, (M.docPos || {})[n.doc] || {}, { p: n.p, o: 0, v: 'file' }), flash: true });
    else D.openItem(n.k, n.r, { beside });
    go('');
  }
  let mapV = null;
  const mapSig = g => g.nodes.map(n => n.id + '=' + n.label).join('|') + '#' + g.links.map(l => l.s + '-' + l.t).join(',');
  /* 2D or 3D: your choice when you made one (the toolbar switch, remembered), else 3D where WebGL is there and the
     device is not weak (a quick check here, then the 3D map times its first frames and hands over to 2D if it lags) */
  const MAPV = 'bb-map-view';
  const mapPref = () => { try { const v = LS && LS.getItem(MAPV); return v === '2d' || v === '3d' ? v : ''; } catch (e) { return ''; } };
  let webgl = null;
  function can3d(g) {
    if (g.nodes.length > (GW.CLOUD_MAX || 600)) return false;
    try { if (sessionStorage.getItem('bb-map-weak')) return false; } catch (e) {}
    const nv = navigator, c = nv.connection;
    if ((nv.deviceMemory && nv.deviceMemory < 2) || (c && c.saveData)) return false;
    if (webgl == null) { try { const cv = document.createElement('canvas'), gl = cv.getContext('webgl'); webgl = !!gl; const x = gl && gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { webgl = false; } }
    return webgl;
  }
  let map3dP = null;
  const load3d = () => map3dP || (map3dP = (window.THREE ? Promise.resolve() : loadScript('three.min.js')).then(() => window.WSGRAPH3D ? 0 : loadScript('wsgraph3d.js?v=2')).then(() => window.WSMAP3D ? 0 : loadScript('wsmap3d.js?v=3')).catch(e => { map3dP = null; throw e; }));
  /* room kept free at the foot of the map: the colour key (two rows on a phone), and the call to action on the example */
  const mapPadB = sample => window.innerWidth < 600 ? (sample ? 250 : 100) : sample ? 130 : 64;
  function viewMap() {
    if (!GW || !window.WSMAP) { main.innerHTML = empty(t('The map could not load. Reload the page.', 'Kartet kunne ikke lastes. Last inn siden på nytt.')); return; }
    const a = mapAny(), g = a.g, sample = a.sample, mode = a.mode, pref = mapPref();
    const want = pref === '2d' ? '2d' : pref === '3d' ? (webgl !== false && g.nodes.length <= (GW.CLOUD_MAX || 600) ? '3d' : '2d') : can3d(g) ? '3d' : '2d';
    if (mapV && mapV.mode === mode && mapV.lang === LAB.lang && mapV.view === want && main.contains(mapV.host)) { const sg = mapSig(g); if (sg !== mapV.sig) { mapV.sig = sg; if (mapV.m) mapV.m.setGraph(g); } return; }
    if (mapV && mapV.m) mapV.m.destroy(); mapV = null;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches, d3 = want === '3d';
    const hint = sample ? (coarse ? t('This is an example. Tap a dot to see what it would be in your workspace, or a group name to see what is in it. Your own map grows as you add aircraft, documents and notes.', 'Dette er et eksempel. Trykk på en prikk for å se hva den ville vært i arbeidsområdet ditt, eller på et gruppenavn for å se hva som er i den. Ditt eget kart vokser etter hvert som du legger til fly, dokumenter og notater.') : t('This is an example. Point at a dot to see what it would be in your workspace, click it to add your own. Your map grows as you add aircraft, documents and notes and link them.', 'Dette er et eksempel. Pek på en prikk for å se hva den ville vært i arbeidsområdet ditt, og klikk for å legge til ditt eget. Kartet ditt vokser etter hvert som du legger til fly, dokumenter og notater og kobler dem.'))
      : d3 ? (coarse ? t('Drag to turn, pinch to zoom, tap a dot for its card, tap a group name to see what is in it.', 'Dra for å snu, knip for å zoome, trykk på en prikk for kortet, trykk på et gruppenavn for å se hva som er i den.') : t('Drag to turn, scroll to zoom, click a dot for its card, a group name to see what is in it, double-click a dot to fly to it. Arrow keys, + and − work too.', 'Dra for å snu, rull for å zoome, klikk på en prikk for kortet, på et gruppenavn for å se hva som er i den, dobbeltklikk på en prikk for å fly dit. Piltastene, + og − virker også.'))
      : coarse ? t('Each aircraft is a cloud of its own. Tap a dot for its card, a group name to see what is in it; pinch to zoom.', 'Hvert fly er en egen sky. Trykk på en prikk for kortet, på et gruppenavn for å se hva som er i den; knip for å zoome.') : t('Each aircraft is a cloud of its own. Click a dot to open it on the desk, Shift-click to open it beside, click a group name to see what is in it; scroll or pinch to zoom.', 'Hvert fly er en egen sky. Klikk på en prikk for å åpne den på arbeidsflaten, Shift-klikk for å åpne den ved siden av, klikk på et gruppenavn for å se hva som er i den; rull eller knip for å zoome.');
    main.innerHTML = `<div class="ws-h ws-maph"><h2>${t('Map', 'Kart')}</h2>
        <p>${t('Each aircraft gathers its own documents, notes and briefing packs in a cloud of its own; items without an aircraft are under Unsorted.', 'Hvert fly samler sine egne dokumenter, notater og briefingpakker i en egen sky; det som ikke hører til et fly, ligger under Uten fly.')}</p></div>
      <div class="wsm-plate${sample ? ' sample' : ''}${d3 ? ' d3' : ''}" id="wsMapPlate"><div class="wsm-host" id="wsMapHost">${d3 ? `<p class="wsm-load" role="status">${t('Opening the 3D map…', 'Åpner 3D-kartet …')}</p>` : ''}</div>
        ${sample ? `<span class="wsm-tag">${t('Example', 'Eksempel')}</span><div class="wsm-cta"><p>${t('Add a document or note to start your map', 'Legg til et dokument eller notat for å starte kartet ditt')}</p><div class="row"><button type="button" class="btn sm pri" data-act="doc-add">${t('Add documents', 'Legg til dokumenter')}</button><button type="button" class="btn sm" data-act="map-note">${t('New note', 'Nytt notat')}</button></div></div>` : ''}</div>
      <p class="wsm-hint">${hint}</p>`;
    const host = el('wsMapHost');
    sizeMap();
    const v = { sample, mode, lang: LAB.lang, host, view: want, sig: mapSig(g), m: null };
    mapV = v;
    const view = { cur: want, onSwitch: m => { try { LS && LS.setItem(MAPV, m); if (m === '3d') sessionStorage.removeItem('bb-map-weak'); } catch (e) {} if (mapV && mapV.m) mapV.m.destroy(); mapV = null; viewMap(); } };
    const mount2d = () => { host.innerHTML = ''; host.closest('.wsm-plate').classList.remove('d3'); v.view = '2d'; v.m = window.WSMAP.mount(host, { graph: g, t, sample, onOpen: mapOpen, padBottom: mapPadB(sample), view: Object.assign({}, view, { cur: '2d' }) }); };
    if (!d3) { mount2d(); return; }
    load3d().then(() => {
      if (mapV !== v || !main.contains(host)) return;
      host.innerHTML = '';
      const ga = mapAny().g; v.sig = mapSig(ga);
      v.m = window.WSMAP3D.mount(host, { graph: ga, t, sample, onOpen: mapOpen, padBottom: mapPadB(sample), view, probe: pref !== '3d', rotateSecs: window.__wsm3dRotate || 20,
        onWeak: why => { if (mapV !== v) return; try { sessionStorage.setItem('bb-map-weak', why || '1'); } catch (e) {} if (v.m) v.m.destroy(); v.m = null; mount2d(); toast(why === 'lost' ? t('The 3D map stopped, so the map is shown in 2D.', '3D-kartet stoppet, så kartet vises i 2D.') : t('This device is showing the map in 2D for speed. Switch to 3D on the map toolbar.', 'Denne enheten viser kartet i 2D for å gå raskere. Bytt til 3D på kartverktøylinjen.')); } });
    }).catch(e => { console.warn('3D map', e); if (mapV === v && main.contains(host)) mount2d(); });
  }
  /* on a large screen the map fills the window below the header, legend included (never smaller than 480 px) */
  function sizeMap() {
    const pl = el('wsMapPlate'); if (!pl) return;
    if (window.innerWidth < 761) { pl.style.height = ''; return; }
    const avail = window.innerHeight - (pl.getBoundingClientRect().top + window.scrollY) - 44;
    pl.style.height = avail >= 480 ? Math.min(900, avail) + 'px' : '';
  }
  window.addEventListener('resize', () => { if (mapV) sizeMap(); });

  function viewMissing(back) { main.innerHTML = `<div class="ws-h"><h2>${t('This item is not here any more', 'Dette elementet finnes ikke her lenger')}</h2><p>${t('It may have been moved to the trash, on this device or another one.', 'Det kan ha blitt flyttet til papirkurven, på denne enheten eller en annen.')}</p></div><div class="chips"><a class="btn" href="#/${back}">${t('Back', 'Tilbake')}</a><a class="btn" href="#/trash">${t('Open the trash', 'Åpne papirkurven')}</a></div>`; }

  let lastPath = null;
  const deskMode = () => { const p = route().path.split('/')[0]; return p === '' || p === 'desk'; };
  function render() {
    if (!S.ready) return;
    const r = route(), p = r.path.split('/'), same = lastPath === r.path;
    const desk = window.WSDESK && deskMode();
    document.documentElement.classList.toggle('ws-deskmode', !!desk);
    if (desk) { closeViewer(); if (mapV) { if (mapV.m) mapV.m.destroy(); mapV = null; } window.WSDESK.show(); drawRail(); drawStatus(); lastPath = r.path;
      const op = r.q.get('open'); if (op && window.FLIGHT) { history.replaceState(null, '', '#/'); lastPath = ''; const l = window.FLIGHT.parseOpen(op); l.forEach((x, i) => window.WSDESK.openItem(x[0], x[1], i ? { beside: true } : {})); if (l.length > 1) window.WSDESK.openItem(l[0][0], l[0][1]); }
      return; }
    if (p[0] === 'notebook' && p[1] && window.WSDESK) { const id = p[1]; history.replaceState(null, '', '#/'); render(); window.WSDESK.openItem('notebook', id); return; }
    if (window.WSDESK) window.WSDESK.hide();
    if (mapV && p[0] !== 'map') { if (mapV.m) mapV.m.destroy(); mapV = null; }
    if (!/^documents\/./.test(r.path)) closeViewer();
    const y = same ? window.scrollY : null;
    if (p[0] === 'search') viewSearch(r.q.get('q') || '');
    else if (p[0] === 'aircraft') p[1] ? viewAircraft(p[1]) : viewAircraftList();
    else if (p[0] === 'documents') p[1] ? viewDoc(p[1], r.q) : viewDocs();
    else if (p[0] === 'packs') viewPacks();
    else if (p[0] === 'notes') p[1] ? viewNote(p[1]) : viewNotes();
    else if (p[0] === 'routes') viewRoutes();
    else if (p[0] === 'map') viewMap();
    else if (p[0] === 'trash') viewTrash();
    else if (p[0] === 'storage') viewStorage();
    else viewHome();
    deskLinks();
    drawRail(); drawStatus();
    if (p[0] !== 'search' && el('wsQ').value && document.activeElement !== el('wsQ')) el('wsQ').value = '';
    if (!same) { if (lastPath !== null && p[0] !== 'search') { const top = el('wsRail').getBoundingClientRect().top + window.scrollY - 8; if (window.scrollY > top) window.scrollTo(0, top); } }
    else if (y != null) window.scrollTo(0, y);
    lastPath = r.path;
  }

  /* ---------- actions ---------- */
  async function doTrash(id) {
    const it = item(id); if (!W.isLive(it)) return;
    await commit(W.trash(it)); if (it.kind === 'doc') await trashFile(id);
    const back = it.kind === 'aircraft' ? 'aircraft' : it.kind === 'doc' ? 'documents' : 'notes';
    if (route().path.includes('/') && !deskMode()) go(back); else render();
    toast(t('Moved to the trash: ', 'Flyttet til papirkurven: ') + itemName(it), [t('Undo', 'Angre'), () => doRestore(id)]);
  }
  async function doRestore(id) { const it = item(id); if (!W.inTrash(it)) return; await commit(W.restore(it)); if (it.kind === 'doc') await untrashFile(id); render(); toast(t('Restored: ', 'Gjenopprettet: ') + itemName(it)); }
  async function doPurge(ids) { const list = ids.map(item).filter(W.inTrash); if (!list.length) return; await commit(list.map(it => W.tombstone(it))); for (const it of list) if (it.kind === 'doc') await ST.tdDel(it.id); await storageInfo(); render(); }
  async function exportAll() {
    const note = el('bkNote'); toast(t('Preparing the backup file…', 'Lager sikkerhetskopien …'));
    try {
      const local = {}; const ns = window.BBACCOUNT && window.BBACCOUNT.nsOf;
      if (LS) for (let i = 0; i < LS.length; i++) { const k = LS.key(i); const g = ns ? ns(k) : (/^naeroson-store-/.test(k) ? 'packs' : null); if (g === 'packs' || g === 'routes' || g === 'progress') local[k] = LS.getItem(k); }
      const docs = Object.values(S.docs).map(d => ({ doc: d, fileName: (d.file && d.file.name) || d.name + (d.blob ? '.pdf' : ''), fileType: (d.file && d.file.type) || (d.blob ? 'application/pdf' : ''),
        load: async () => { const b = hasFile(d.id) ? await FI.getBlob(d.id) : null; return b ? { u8: new Uint8Array(await b.arrayBuffer()), keep: b } : null; } }));
      const z = await W.buildBackup({ items: S.items, local, docs });
      const blob = new Blob(z.finish(), { type: 'application/zip' });
      download(blob, 'birdbird-backup-' + new Date().toISOString().slice(0, 10) + '.zip');
      M.backupAt = Date.now(); await saveMeta(); render();
      toast(t('Backup file saved to your downloads (', 'Sikkerhetskopien er lagret i nedlastinger (') + W.fmtBytes(blob.size) + ').');
    } catch (e) { const m = e && e.code === 'zip_too_big' ? t('The backup would be larger than 4 GB. Remove some large documents and try again.', 'Sikkerhetskopien ville blitt større enn 4 GB. Fjern noen store dokumenter og prøv igjen.') : t('The backup could not be made. Free some space on the device and try again.', 'Sikkerhetskopien kunne ikke lages. Frigjør litt plass på enheten og prøv igjen.'); toast(m); if (note) note.textContent = m; }
  }
  async function importBackup(file) {
    try {
      const b = await W.readBackup(file);
      const m = W.mergeItems(S.items, b.items, 0), changed = Object.values(m.items).filter(it => W.stable(it) !== W.stable(S.items[it.id]));
      let files = 0, docs = 0;
      for (const d of b.docs) {
        const have = S.docs[d.doc.id], e = m.items[d.doc.id];
        if (e && !W.isLive(e)) continue;
        if (have && (hasFile(d.doc.id) || !d.fileName)) continue;
        let blob = d.fileName ? await d.blob(d.fileType) : null; if (!blob && d.fileName) { const u = await d.read(); if (u) blob = new Blob([u], { type: d.fileType }); }
        if (FI.db) { await FI.put(have || d.doc, blob); docs += have ? 0 : 1; if (blob) files++; }
      }
      if (changed.length) await commit(changed);
      if (LS) for (const k in b.local) { try { const v = W.mergeLocalKey(k, LS.getItem(k), b.local[k]); if (v !== LS.getItem(k)) LS.setItem(k, v); } catch (e) {} }
      await FI.load(); await reconcile(); await loadStores(); await storageInfo();
      const c = k => Object.values(b.items).filter(x => x.kind === k && W.isLive(x)).length;
      render();
      const msg = t(`Backup from ${day(b.exportedAt)} imported: ${c('aircraft')} aircraft, ${c('note')} notes, ${c('doc')} documents (${files} files added to this device).`, `Sikkerhetskopi fra ${day(b.exportedAt)} importert: ${c('aircraft')} fly, ${c('note')} notater, ${c('doc')} dokumenter (${files} filer lagt til på denne enheten).`);
      toast(msg); const n = el('bkNote'); if (n) n.textContent = msg;
    } catch (e) {
      const msg = e && e.code === 'bad_backup' ? t('That file is not a Birdbird backup. Choose the .zip file made with “Export everything”.', 'Den filen er ikke en Birdbird-sikkerhetskopi. Velg .zip-filen som ble laget med «Eksporter alt».') : e && e.code === 'bad_crc' ? t('The backup file is damaged, so nothing was imported. Try another copy of it.', 'Sikkerhetskopien er skadet, så ingenting ble importert. Prøv en annen kopi av den.') : t('The backup could not be imported. Nothing on this device was changed.', 'Sikkerhetskopien kunne ikke importeres. Ingenting på denne enheten ble endret.');
      toast(msg); const n = el('bkNote'); if (n) n.textContent = msg;
    }
  }
  async function wipeAll() {
    const u = user(), n = W.live(S.items).length + W.trashed(S.items).length;
    const ok = await openDlg(`<h3 id="wsDlgH">${t('Delete everything in My Workspace?', 'Slette alt i Mitt arbeidsområde?')}</h3>
      <p>${t(`This removes ${n} items – every aircraft, note and document, the document files, and the trash – from this device`, `Dette fjerner ${n} elementer – alle fly, notater og dokumenter, dokumentfilene og papirkurven – fra denne enheten`)}${u ? t(' and from your account, so they also disappear from your other devices', ' og fra kontoen din, slik at de også forsvinner fra de andre enhetene dine') : ''}. ${t('The documents also disappear from Flight Intelligence. It cannot be undone.', 'Dokumentene forsvinner også fra Flight Intelligence. Det kan ikke angres.')}</p>
      <p>${t('Export a backup file first if you might want any of it back.', 'Eksporter en sikkerhetskopi først hvis du kanskje vil ha noe av det tilbake.')}</p>
      <div class="fld"><label class="ck"><input type="checkbox" id="wipeCk"> ${t('I understand that this cannot be undone', 'Jeg forstår at dette ikke kan angres')}</label></div>
      <div class="foot"><button type="button" class="btn" data-close>${t('Cancel', 'Avbryt')}</button><button type="button" class="btn danger" id="wsDlgOk" disabled>${t('Delete everything', 'Slett alt')}</button></div>`, close => { el('wipeCk').onchange = e => { el('wsDlgOk').disabled = !e.target.checked; }; el('wsDlgOk').onclick = () => close(true); });
    if (!ok) return;
    for (const id of Object.keys(S.docs)) await FI.del(id);
    if (u) { const tomb = Object.values(S.items).filter(it => !it.gone).map(it => W.tombstone(it)); await ST.clearItems(); S.items = {}; await commit(tomb); await syncNow(true); }
    else { await ST.clearItems(); S.items = {}; S.index = null; }
    M.recent = []; M.backupAt = 0; M.hideAdopt = {}; M.sync.full = null; await saveMeta(); await storageInfo();
    go(''); render(); toast(t('Everything in My Workspace was deleted.', 'Alt i Mitt arbeidsområde er slettet.'));
  }
  async function adopt(k) {
    const s = adoptable().find(x => x.k === k); if (!s) return;
    const a = W.newAircraft({ typeKey: guessTypeKey(s.type + ' ' + s.name), type: s.type || s.name, reg: s.reg, fiac: s.fiac, isDefault: !aircraft().length });
    const list = [a]; if (s.fiac) docsAll().forEach(d => { const fd = S.docs[d.id]; if (fd && fd.ac === s.fiac && !(d.acIds || []).includes(a.id)) list.push(W.patch(d, { acIds: (d.acIds || []).concat(a.id) })); });
    await commit(list); go('aircraft/' + a.id);
  }

  document.addEventListener('click', async e => {
    const v = e.target.closest('[data-visit]'); if (v) { const i = v.dataset.visit.indexOf(':'); visit(v.dataset.visit.slice(0, i), v.dataset.visit.slice(i + 1)); }
    const b = e.target.closest('[data-act]'); if (!b || b.closest('#wsStatus')) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'ac-new') { const nid = await aircraftDlg(null); if (nid) go('aircraft/' + nid); }
    else if (act === 'ac-edit') { if (await aircraftDlg(item(id))) render(); }
    else if (act === 'ac-adopt') adopt(id);
    else if (act === 'ac-hide') { M.hideAdopt[id] = 1; saveMeta(); render(); }
    else if (act === 'doc-add') pickFiles({ acId: id || null });
    else if (act === 'doc-file') pickFiles({ replaceId: id });
    else if (act === 'doc-dl') { const bl = await FI.getBlob(id), d = S.docs[id]; if (bl) download(bl, (d && d.file && d.file.name) || (item(id).name + '.' + (item(id).ext || 'pdf'))); }
    else if (act === 'note-new') newNote(id || null);
    else if (act === 'pack-new') newPack(id || null);
    else if (act === 'pack-dup') dupPack(id);
    else if (act === 'pack-pin') { const m = packMark(id); await commit(m ? W.patch(m, { pinned: !m.pinned }) : W.newPackMark(id, { pinned: true })); render(); }
    else if (act === 'trash') doTrash(id);
    else if (act === 'restore') doRestore(id);
    else if (act === 'purge') { const it = item(id); if (await confirmDlg({ title: t('Delete for good?', 'Slette for godt?'), text: t('“' + itemName(it) + '” will be removed from this device' + (user() ? ' and your account' : '') + (it.kind === 'doc' ? ', including the file' : '') + '. It cannot be undone.', '«' + itemName(it) + '» fjernes fra denne enheten' + (user() ? ' og kontoen din' : '') + (it.kind === 'doc' ? ', inkludert filen' : '') + '. Det kan ikke angres.'), ok: t('Delete for good', 'Slett for godt'), danger: true })) doPurge([id]); }
    else if (act === 'trash-empty') { const l = W.trashed(S.items); if (await confirmDlg({ title: t('Empty the trash?', 'Tømme papirkurven?'), text: t(`${l.length} items will be removed for good, including any document files. It cannot be undone.`, `${l.length} elementer fjernes for godt, inkludert eventuelle dokumentfiler. Det kan ikke angres.`), ok: t('Empty the trash', 'Tøm papirkurven'), danger: true })) doPurge(l.map(x => x.id)); }
    else if (act === 'export') exportAll();
    else if (act === 'import') { const inp = el('wsBackupFile'); inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) importBackup(f); }; inp.click(); }
    else if (act === 'persist') { await askPersist(); await storageInfo(); render(); if (S.est.persisted !== true) toast(t('The browser did not agree this time. It decides this itself, often after you have used the site for a while or added it to the Home Screen.', 'Nettleseren sa ikke ja denne gangen. Den avgjør dette selv, ofte etter at du har brukt nettstedet en stund eller lagt det til på Hjem-skjermen.')); }
    else if (act === 'sync') syncNow(true);
    else if (act === 'wipe') wipeAll();
    else if (act === 'search-clear') { el('wsQ').value = ''; go(beforeSearch || 'library'); }
    else if (act === 'desk-open' && window.WSDESK) { e.preventDefault(); window.WSDESK.openItem(b.dataset.k, id); go(''); }
    else if (act === 'map-note') { const n = W.newNote({}); await commit(n); if (window.WSDESK) { window.WSDESK.openItem('note', n.id); go(''); } else go('notes/' + n.id); }
    else if (act === 'nb-new' && window.WSDESK) { go(''); setTimeout(() => window.WSDESK.newNotebook({}), 30); }
  });

  /* search box */
  let beforeSearch = '', qT = 0;
  const qIn = el('wsQ');
  qIn.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => {
    const q = qIn.value.trim(), r = route();
    if (q) { if (r.path !== 'search') beforeSearch = r.path; history.replaceState(null, '', '#/search?q=' + encodeURIComponent(q)); render(); }
    else if (r.path === 'search') { history.replaceState(null, '', '#/' + beforeSearch); render(); }
  }, 140); });
  el('wsSearchForm').addEventListener('submit', e => { e.preventDefault(); const f = main.querySelector('.ws-res a.n'); if (f) f.focus(); });
  document.addEventListener('keydown', e => { if (deskMode()) return; if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) { const a = document.activeElement; if (a && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { if (a.isContentEditable) e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); qIn.focus(); qIn.select(); } }, true);

  /* ---------- language ---------- */
  function drawChrome() {
    el('wsH1').textContent = t('My workspace', 'Mitt arbeidsområde');
    el('wsHomeT').textContent = t('Back to the desk', 'Tilbake til arbeidsflaten');
    el('wsQLabel').textContent = t('Search your workspace', 'Søk i arbeidsområdet ditt');
    qIn.placeholder = t('Aircraft, documents, notes, packs, routes', 'Fly, dokumenter, notater, pakker, ruter');
    document.title = t('My workspace · Birdbird', 'Mitt arbeidsområde · Birdbird');
  }

  /* ---------- start ---------- */
  const pmark = n => { try { performance.mark('ws:' + n); } catch (e) {} };
  async function start() {
    LAB.start('workspace'); drawChrome(); pmark('start');
    /* the two databases and the packs/routes store are read side by side */
    const fiP = FI.open().then(() => FI.load()), lsP = loadStores();
    await ST.open(); pmark('idb');
    const [items, meta] = await Promise.all([ST.loadItems().catch(() => ({})), ST.kvGet('meta')]);
    if (meta && typeof meta === 'object') M = Object.assign(M, meta, { sync: Object.assign(M.sync, meta.sync || {}) });
    M.hideAdopt = M.hideAdopt || {}; M.recent = M.recent || [];
    const pg = W.purgeExpired(items); S.items = pg.items; itemsIn = true; readyRes();
    if (pg.purged.length) { ST.putItems(pg.purged.map(it => S.items[it.id])).catch(() => {}); pg.purged.forEach(it => { if (it.kind === 'doc') ST.tdDel(it.id); }); }
    await Promise.all([fiP, lsP]); pmark('data');
    await reconcile();
    S.ready = true;
    render(); pmark('render');
    /* the storage estimate is only shown on the Overview and Storage pages: it is read after the first paint */
    storageInfo().then(() => { if (W.live(S.items).length && S.est.persisted === false) askPersist(); if (/^(storage|library)$/.test(route().path)) render(); });
    if (user()) syncNow();
  }
  window.addEventListener('hashchange', () => { if (route().path !== 'search') { clearTimeout(qT); } render(); const r = route(); if (r.path !== 'search' && lastPath !== null && document.activeElement === document.body) main.focus({ preventScroll: true }); });
  LAB.onLang(() => { drawChrome(); render(); });
  document.addEventListener('bb-account', () => { drawStatus(); if (S.ready && user() && SY.state !== 'syncing' && Date.now() - SY.lastRun > 8000) syncNow(); if (S.ready && !user()) { SY.state = 'idle'; const p = route().path; if (p === '' || p === 'storage') render(); } });
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState !== 'visible' || !S.ready) return; await loadStores(); await FI.load(); await reconcile(); const a = document.activeElement; if (!(a && main.contains(a) && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName))) && !dlg.open) render(); else drawRail(); if (user() && Date.now() - (M.sync.last || 0) > 30000) syncNow(); });
  window.addEventListener('online', () => { if (user()) syncNow(); });
  window.addEventListener('storage', e => { if (e.key && /^naeroson-store-/.test(e.key)) loadStores().then(() => { drawRail(); }); });
  setInterval(() => { if (S.ready && document.visibilityState === 'visible') drawStatus(); }, 30000);

  /* item pages in the Library get an "Open on the desk" button */
  function deskLinks() {
    const r = route().path.split('/'); if (!r[1] || !window.WSDESK) return;
    const k = { aircraft: 'aircraft', documents: 'doc', notes: 'note' }[r[0]], it = item(r[1]); if (!k || !W.isLive(it)) return;
    const back = main.querySelector('.ws-back'); if (!back || main.querySelector('.ws-deskopen')) return;
    back.insertAdjacentHTML('afterend', `<a class="btn sm ws-deskopen" href="#/" data-act="desk-open" data-k="${k}" data-id="${esc(it.id)}">${t('Open on the desk', 'Åpne på arbeidsflaten')}</a>`);
  }

  window.WS = { state: S, noteFormats, syncNow, exportAll, importBackup, render, get meta() { return M; }, get sync() { return SY; }, get map() { return mapV && mapV.m; }, get mapView() { return mapV && mapV.view; } };
  /* what the desk (desk.js) uses: the same storage, names and dialogs as the Library */
  window.WS.api = { W, S, t, esc, el, ago, day, clock, dayClock, plural, item, liveOf, aircraft, docsAll, notesAll, packsAll, hasFile, onDevice, packMark, packAc, FI, ST, LS, pdfjs, loadScript, extOf,
    notebooksAll, useInTrainer, ockCan, OCK_TR, commit, visit, toast, openDlg, confirmDlg, download, go, route, findAll, recentList, catName, kindName, acName, noteTitle, packTitle, routeTitle, itemName, TRAINER, speedRow, linkLabel,
    doTrash, doRestore, pickFiles, addFiles, linkDoc, aircraftDlg, newPack, statusShort, saveMeta, render, deskMode, noteFormats, mapGraph, mapAny, get M() { return M; } };
  if (window.WSDESK_INIT) window.WSDESK_INIT(window.WS.api);
  start().catch(e => { console.error('workspace start', e); main.innerHTML = `<div class="ws-empty"><p><b>${t('My workspace could not open.', 'Mitt arbeidsområde kunne ikke åpnes.')}</b> ${t('Reload the page. If it keeps happening, the browser may be blocking storage for this site.', 'Last inn siden på nytt. Hvis det fortsetter, kan nettleseren blokkere lagring for dette nettstedet.')}</p></div>`; });
})();
