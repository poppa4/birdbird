/* Birdbird – My Workspace: the desk (the default view, #/). Layout model in deskcore.js; storage, sync, names and
   dialogs come from workspace.js (WS.api). One screen like a desk: the library on the left, panes with tabs on the right.
   A desk is a 'desk' item in the 'workspace' namespace and holds positions only (which tabs, where, which page).
   Tab types live in TYPES below: { icon, title(r), mount(box, tab, ctx) -> view { destroy, refresh?, save?, goPage? } }.
   The pen notebook and the ink on PDF pages live in notebook.js (WSNB), "Ask your documents" in ask.js (WSASK);
   both get their helpers from here (initExt below). */
(function () {
  'use strict';
  window.WSDESK_INIT = function (A) {
    const D = window.DESKCORE, W = A.W, S = A.S, t = A.t, esc = A.esc;
    const host = document.getElementById('wsDesk');
    const SNAP = 'bb-ws-desk', DEFAULT_ID = 'dk-main';
    const isPhone = () => window.innerWidth < 760;
    const maxPanes = () => isPhone() ? 1 : window.innerWidth < 1100 ? 3 : 4;
    const canDown = () => !isPhone() && window.innerWidth >= 1000 && window.innerHeight >= 700;
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const KEY = isMac ? '⌘K' : 'Ctrl K';
    const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

    /* ---------- icons (one stroke family, 20px grid) ---------- */
    const P = {
      doc: '<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/><path d="M7.5 10h5M7.5 13h5"/>',
      pdf: '<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/><path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h3"/>',
      img: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3.5 14l4-4 3 3 2-2 4 4"/><circle cx="13" cy="7.5" r="1.2"/>',
      note: '<path d="M4 3h12v14H4z"/><path d="M7 7h6M7 10h6M7 13h3.5"/>',
      aircraft: '<path d="M10 2.5c.8 0 1.2.9 1.2 2v3.6l5.3 3v1.6l-5.3-1.5v3.3l1.8 1.4v1.3L10 16.4l-3 .8v-1.3l1.8-1.4v-3.3l-5.3 1.5v-1.6l5.3-3V4.5c0-1.1.4-2 1.2-2z"/>',
      pack: '<rect x="4" y="3.5" width="12" height="14" rx="1"/><path d="M7.5 3.5V2.5h5v1M7 8h6M7 11h6M7 14h4"/>',
      route: '<circle cx="4.5" cy="15" r="1.6"/><circle cx="15.5" cy="5" r="1.6"/><path d="M6 14l3.5-5.5 2.5 2L14.3 6.3"/>',
      notebook: '<path d="M4 3h11v14H4z"/><path d="M7 3v14"/><path d="M9.5 12.5l4-4 1 1-4 4-1.5.5z"/>',
      search: '<circle cx="8.5" cy="8.5" r="5.2"/><path d="M12.6 12.6 17 17"/>',
      splith: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M10 3.5v13"/>',
      splitv: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M2.5 10h15"/>',
      rail: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M7.5 3.5v13"/>',
      x: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
      more: '<circle cx="5" cy="10" r=".9"/><circle cx="10" cy="10" r=".9"/><circle cx="15" cy="10" r=".9"/>',
      chev: '<path d="M6 8l4 4 4-4"/>',
      right: '<path d="M8 5l5 5-5 5"/>',
      left: '<path d="M12 5l-5 5 5 5"/>',
      plus: '<path d="M10 4.5v11M4.5 10h11"/>',
      minus: '<path d="M4.5 10h11"/>',
      pin: '<path d="M8 3h4l-.6 4.5 2.6 2.5H6l2.6-2.5z"/><path d="M10 10v7"/>',
      beside: '<rect x="2.5" y="3.5" width="15" height="13" rx="1"/><path d="M10 3.5v13M12.5 8.5h3M14 7v3"/>',
      cite: '<path d="M4 4h8l4 4v8H4z"/><path d="M7 10h6M10 7v6"/>',
      lib: '<path d="M3.5 3.5h3v13h-3zM8.5 3.5h3v13h-3z"/><path d="M13.3 4.2l2.9-.7 2.6 12.6-2.9.7z"/>',
      up: '<path d="M4 4h12v12H4z"/><path d="M10 7v6M7.5 9.5L10 7l2.5 2.5"/>',
      tabs: '<rect x="3" y="6" width="14" height="10.5" rx="1"/><path d="M5 3.5h10"/>',
      keep: '<path d="M10 2.8l6 2.4v4.3c0 3.7-2.6 6.4-6 7.7-3.4-1.3-6-4-6-7.7V5.2z"/><path d="M7.3 10l2 2 3.6-3.8"/>',
      resume: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l2.8 1.8"/>',
      device: '<rect x="5" y="2.5" width="10" height="15" rx="1.6"/><path d="M8.5 15h3"/>',
      ask: '<path d="M3.5 4.5h13v9h-7l-3.5 3v-3h-2.5z"/><path d="M8.2 7.6a1.9 1.9 0 113 1.5c-.7.4-1.2.8-1.2 1.5"/><path d="M10 12.2v.1"/>',
      pen: '<path d="M4 16l1-4 8.5-8.5 3 3L8 15z"/><path d="M12 5l3 3"/>',
      map: '<circle cx="5" cy="6" r="1.6"/><circle cx="14.5" cy="4.5" r="1.3"/><circle cx="11" cy="11" r="2"/><circle cx="4.5" cy="15" r="1.3"/><circle cx="15.5" cy="15.5" r="1.6"/><path d="M6.4 6.8l3.2 2.9M13.8 5.7l-1.9 3.5M9.4 12.3l-3.6 1.9M12.6 12.4l1.8 1.8"/>'
    };
    const ic = (k, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${P[k] || P.doc}</svg>`;

    /* ---------- what can be open on the desk ---------- */
    const findPack = r => S.packs.find(x => x.id === r) || null, findRoute = r => S.routes.find(x => x.id === r) || null;
    const isGone = r => { const it = A.item(r); return !!(it && it.gone); };
    function docKind(d) { const e = (d && d.ext) || ''; return e === 'pdf' ? 'pdf' : /^(png|jpe?g|webp|gif)$/.test(e) ? 'img' : 'doc'; }
    const TYPES = {
      doc: { icon: r => docKind(A.item(r)), title: r => { const d = A.item(r); return d && d.name ? d.name : t('Document', 'Dokument'); }, mount: mountDoc },
      note: { icon: () => 'note', title: r => { const n = A.item(r); return n && !n.gone ? A.noteTitle(n) : t('Note', 'Notat'); }, mount: mountNote },
      aircraft: { icon: () => 'aircraft', title: r => { const a = A.item(r); return a && !a.gone ? (a.reg || A.acName(a)) : t('Aircraft', 'Fly'); }, mount: mountAircraft },
      pack: { icon: () => 'pack', title: r => { const p = findPack(r); return p ? A.packTitle(p) : t('Briefing pack', 'Briefingpakke'); }, mount: mountPack },
      route: { icon: () => 'route', title: r => { const x = findRoute(r); return x ? A.routeTitle(x) : t('Route', 'Rute'); }, mount: mountRoute },
      notebook: { icon: () => 'notebook', title: r => { const n = A.item(r); return n && !n.gone && n.title ? n.title : t('Notebook', 'Notatbok'); }, mount: mountNotebook },
      ask: { icon: () => 'ask', title: () => t('Ask your documents', 'Spør dokumentene'), mount: mountAsk }
    };
    const typeOf = k => TYPES[k] || { icon: () => 'doc', title: () => k, mount: mountUnknown };

    /* ---------- state ---------- */
    let desk = null, L = null, mounted = false, phoneMode = null, treeKey = '', saveT = 0, localEditAt = 0, lastNoteTab = null;
    const panesEl = new Map();          // pane id -> { el, strip, body, view: { tabId, k, v } }
    const views = new Map();            // tab id -> view
    let barEl, railEl, mainEl, sheetEl;

    function desks() { return D.desksOf(S.items); }
    function pickDesk() {
      const list = desks(); const d = list.find(x => x.id === A.M.desk) || list[0];
      if (d && /^(My desk|Min arbeidsflate)$/.test(d.name || '')) d.name = t('My desk', 'Min arbeidsflate');
      return d || { id: DEFAULT_ID, kind: 'desk', name: t('My desk', 'Min arbeidsflate'), L: D.newLayout(), createdAt: 0, updatedAt: 0, unsaved: true };
    }
    function readSnap() { try { return JSON.parse(A.LS && A.LS.getItem(SNAP)); } catch (e) { return null; } }
    function loadDesk(d) {
      unmountViews();
      desk = { id: d.id, name: d.name, unsaved: !!d.unsaved, updatedAt: d.updatedAt || 0 };
      L = D.sanitize(d.L);
      const snap = readSnap(); if (snap && snap.id === d.id && (snap.at || 0) > (d.updatedAt || 0) && snap.L) L = D.sanitize(snap.L);
      L = D.prune(L, (k, r) => !((k === 'doc' || k === 'note' || k === 'aircraft' || k === 'notebook') && isGone(r)));
      if (A.M.desk !== d.id) { A.M.desk = d.id; A.saveMeta(); }
      treeKey = '';
    }
    /* every layout change goes through here; kind 'pos' (page, scroll) saves later and syncs much later */
    function changed(nl, kind) {
      L = nl; localEditAt = Date.now();
      clearTimeout(saveT); saveT = setTimeout(saveNow, kind === 'pos' ? 1500 : 250);
      if (kind !== 'pos') { render(); drawRail(); }
    }
    function saveNow() {
      clearTimeout(saveT); saveT = 0; if (!desk) return;
      if (desk.unsaved && !D.allTabs(L).length && D.panes(L).length < 2) return;            // nothing worth keeping yet
      const cur = A.item(desk.id), lay = D.sanitize(L);
      if (cur && !cur.gone && W.stable(cur.L) === W.stable(lay) && cur.name === desk.name) return;
      const it = cur && !cur.gone ? W.patch(cur, { L: lay, name: desk.name }) : D.newDesk({ id: desk.id, name: desk.name, L: lay });
      desk.unsaved = false; desk.updatedAt = it.updatedAt;
      A.commit(it, { wait: 12000 });
    }
    function snapshot() {
      if (!mounted || !desk) return; collectStates();
      try { if (A.LS) A.LS.setItem(SNAP, JSON.stringify({ id: desk.id, L, at: Date.now() })); } catch (e) {}
      saveNow();
    }
    function collectStates() { views.forEach((v, tabId) => { if (v.save) { const st = v.save(); if (st && D.tabById(L, tabId)) L = D.setState(L, tabId, st); } }); }
    function posChanged(tabId, st) { if (!D.tabById(L, tabId)) return; const nl = D.setState(L, tabId, st); if (W.stable(nl) !== W.stable(L)) changed(nl, 'pos'); }

    /* ---------- opening things ---------- */
    function openItem(k, r, opts) {
      opts = opts || {}; if (!mounted) { pendingOpen.push([k, r, opts]); return; }
      if (k === 'doc' && !opts.st) { const pos = (A.M.docPos || {})[r]; if (pos) opts = Object.assign({}, opts, { st: pos }); }
      const res = D.open(L, k, String(r), { pane: opts.pane, beside: opts.beside && !isPhone(), dir: opts.dir, max: maxPanes(), st: opts.st });
      if (!res.tabId) { A.toast(t('This pane is full. Close a few tabs first.', 'Dette panelet er fullt. Lukk noen faner først.')); return null; }
      if (['doc', 'note', 'aircraft', 'pack', 'route', 'notebook'].includes(k)) A.visit(k, r);
      changed(res.L, 'shape');
      closeSheet();
      if (opts.st && opts.st.p && (res.existed || opts.flash)) { const v = views.get(res.tabId); if (v && v.goPage) v.goPage(opts.st.p, opts.st.o || 0, !!opts.flash); }
      return res.tabId;
    }
    const pendingOpen = [];
    async function newNote(f, opts) {
      const n = W.newNote(f || {}); await A.commit(n);
      const tabId = openItem('note', n.id, opts || {});
      const v = views.get(tabId); if (v && v.focusEnd && n.body) setTimeout(() => v.focusEnd(), 40);
      return n;
    }
    /* "New note beside": a note linked to the document, starting with a page reference back to it */
    async function noteBeside(docId, page, label, fromPane) {
      const d = A.item(docId); if (!W.isLive(d)) return;
      const html = '<div>' + D.citeHtml(docId, page, label, d.name) + '</div><div><br></div>';
      await newNote({ title: t('Notes: ', 'Notater: ') + d.name, body: html, links: [{ t: 'doc', id: docId }] }, { pane: fromPane, beside: true });
    }
    /* the note to put a page reference into: the one showing in another pane (on a phone, the last note opened) */
    function targetNote(exceptPane) {
      if (isPhone()) { const tb = lastNoteTab && D.tabById(L, lastNoteTab); return tb ? { tabId: tb.id, v: views.get(tb.id) || null } : null; }
      for (const p of D.panes(L)) { if (p.id === exceptPane) continue; const tb = p.tabs.find(x => x.id === p.a); if (tb && tb.k === 'note') { const v = views.get(tb.id); if (v && v.insertCite) return { tabId: tb.id, v }; } }
      return null;
    }
    function citeInto(docId, page, label) {
      const d = A.item(docId), tn = targetNote(paneOfDoc(docId)); if (!d || !tn) return false;
      const html = D.citeHtml(docId, page, label, d.name);
      if (tn.v) tn.v.insertCite(html);
      else { const n = A.item(D.tabById(L, tn.tabId).r); if (W.isLive(n)) A.commit(W.editNote(n, { body: n.body + '<div>' + html + '</div>' })); }
      A.toast(t('Page reference added to “', 'Sidehenvisning lagt til i «') + A.noteTitle(A.item(D.tabById(L, tn.tabId).r)) + t('”.', '».'));
      return true;
    }
    const paneOfDoc = docId => { const f = D.findItem(L, 'doc', docId); return f ? f.pane.id : null; };
    /* an answer from "Ask" into the note beside (or a new note beside, linked to the document) */
    async function quoteInto(html, docId, fromPane) {
      const tn = targetNote(fromPane);
      if (tn && tn.v && tn.v.insertCite) { tn.v.insertCite(html); A.toast(t('Copied into “', 'Kopiert inn i «') + A.noteTitle(A.item(D.tabById(L, tn.tabId).r)) + t('”.', '».')); return; }
      if (tn) { const n = A.item(D.tabById(L, tn.tabId).r); if (W.isLive(n)) { await A.commit(W.editNote(n, { body: n.body + html })); A.toast(t('Copied into the note.', 'Kopiert inn i notatet.')); return; } }
      const d = docId && A.item(docId);
      await newNote({ title: d ? t('Notes: ', 'Notater: ') + d.name : t('Notes', 'Notater'), body: html + '<div><br></div>', links: d ? [{ t: 'doc', id: docId }] : [] }, { pane: fromPane, beside: true });
    }
    /* the document showing in another pane than this one (for "the open document") */
    function docBeside(paneId) {
      for (const p of (phoneMode ? [] : D.panes(L))) { if (p.id === paneId) continue; const tb = p.tabs.find(x => x.id === p.a); if (tb && tb.k === 'doc' && W.isLive(A.item(tb.r))) return tb.r; }
      const at = D.allTabs(L).find(x => x.k === 'doc' && W.isLive(A.item(x.r))); return at ? at.r : null;
    }
    async function newNotebook(opts) { if (!window.WSNB) return; await window.WSNB.create({}, opts || {}); }
    function askBeside(docId, fromPane) { if (window.WSASK) window.WSASK.setDoc(docId || null); openItem('ask', 'ask', { pane: fromPane, beside: !!docId }); }
    /* a page reference in a note was clicked: show that page, beside the note */
    function jumpTo(docId, page, fromPane) {
      const d = A.item(docId);
      if (!d || !W.isLive(d)) { A.toast(t('That document is not in your library any more.', 'Det dokumentet finnes ikke i biblioteket lenger.')); return; }
      const f = D.findItem(L, 'doc', docId);
      if (f) { changed(D.activate(L, f.pane.id, f.tab.id), 'shape'); const v = views.get(f.tab.id); if (v && v.goPage) v.goPage(page, 0, true); return; }
      openItem('doc', docId, { pane: fromPane, beside: true, st: Object.assign({}, (A.M.docPos || {})[docId] || {}, { p: page, o: 0, v: 'file' }), flash: true });
    }

    /* ---------- drawing ---------- */
    function mount() {
      mounted = true; host.hidden = false;
      const main = document.getElementById('wsMain'); if (main) main.innerHTML = '';      // the Library view is not shown on the desk
      loadDesk(pickDesk());
      host.innerHTML = `<div class="dk-bar" id="dkBar"></div><div class="prog dk-prog" id="wsProg" hidden><span></span><div class="bar"><i></i></div></div>
        <div class="dk-body"><nav class="dk-rail" id="dkRail" aria-label="${esc(t('Library', 'Bibliotek'))}"></nav><div class="dk-main" id="dkMain"></div></div>
        <div class="dk-sheet" id="dkSheet" hidden><div class="dk-sheet-bg" data-sheet-close></div><div class="dk-sheet-in" role="dialog" aria-modal="true" aria-label="${esc(t('Library', 'Bibliotek'))}"><div class="dk-grip" data-sheet-close></div><div class="dk-sheet-c"></div></div></div>`;
      barEl = host.querySelector('#dkBar'); railEl = host.querySelector('#dkRail'); mainEl = host.querySelector('#dkMain'); sheetEl = host.querySelector('#dkSheet');
      wire();
      sizeHost(); drawBar(); drawRail(); render(true);
      pendingOpen.splice(0).forEach(x => openItem(x[0], x[1], x[2]));
    }
    function unmountViews() { panesEl.forEach(pe => { if (pe.view) destroyView(pe); }); panesEl.clear(); views.clear(); treeKey = ''; }
    function show() {
      if (!mounted) { mount(); return; }
      host.hidden = false; refresh();
    }
    function hide() {
      if (!mounted) return;
      snapshot(); unmountViews(); host.innerHTML = ''; host.hidden = true; mounted = false; closeMenu();
    }
    /* the store changed (sync, another tab, a dialog): redraw names, keep everything that is open */
    function refresh() {
      if (!desk) return;
      const cur = A.item(desk.id);
      if (cur && (cur.deletedAt || cur.gone)) { loadDesk(pickDesk()); render(true); drawBar(); drawRail(); return; }
      if (cur && cur.updatedAt > desk.updatedAt && Date.now() - localEditAt > 60000 && D.shape(cur.L) !== D.shape(L)) { desk.updatedAt = cur.updatedAt; desk.name = cur.name; L = D.sanitize(cur.L); render(true); }
      else if (cur) desk.name = cur.name;
      drawBar(); drawRail(); render();
    }
    function sizeHost() {
      if (!mounted) return;
      const top = host.getBoundingClientRect().top + window.scrollY;
      host.style.height = Math.max(320, window.innerHeight - top) + 'px';
    }
    function drawBar() {
      if (!barEl) return;
      const ph = isPhone(), st = A.statusShort();
      barEl.innerHTML = `${ph ? '' : `<button type="button" class="dk-ib" data-b="rail" aria-label="${esc(t('Show or hide the library', 'Vis eller skjul biblioteket'))}" aria-expanded="${!railCollapsed()}" title="${esc(t('Library', 'Bibliotek'))}">${ic('rail')}</button>`}
        <button type="button" class="dk-deskbtn" data-b="desks" aria-haspopup="menu" title="${esc(t('Switch desk', 'Bytt arbeidsflate'))}"><span class="eb">${esc(t('Desk', 'Arbeidsflate'))}</span><span class="nm">${esc(desk.name)}</span>${ic('chev')}</button>
        <button type="button" class="dk-qo" data-b="open" aria-keyshortcuts="${isMac ? 'Meta+K' : 'Control+K'}">${ic('search')}<span>${esc(t('Open anything', 'Åpne hva som helst'))}</span>${ph ? '' : `<kbd>${KEY}</kbd>`}</button>
        <span class="sp"></span>
        <a class="dk-st" href="#/storage" title="${esc(st.title || '')}"><i class="kept ${st.c}"></i><span>${esc(st.s)}</span></a>
        ${ph ? `<button type="button" class="dk-ib" data-b="sheet" aria-label="${esc(t('Library', 'Bibliotek'))}">${ic('lib')}</button>` : `<button type="button" class="dk-ib" data-b="split-h" title="${esc(t('Split right', 'Del til høyre'))}" aria-label="${esc(t('Split right', 'Del til høyre'))}"${D.panes(L).length >= maxPanes() ? ' disabled' : ''}>${ic('splith')}</button>${canDown() ? `<button type="button" class="dk-ib" data-b="split-v" title="${esc(t('Split down', 'Del nedover'))}" aria-label="${esc(t('Split down', 'Del nedover'))}"${D.panes(L).length >= maxPanes() ? ' disabled' : ''}>${ic('splitv')}</button>` : ''}`}
        ${ph ? '' : `<a class="dk-ib dk-mapb" href="#/map" title="${esc(t('Map of your workspace', 'Kart over arbeidsområdet'))}" aria-label="${esc(t('Map of your workspace', 'Kart over arbeidsområdet'))}">${ic('map')}</a>`}
        <a class="dk-lib" href="#/library">${ph ? esc(t('Manage', 'Administrer')) : esc(t('Library and backup', 'Bibliotek og sikkerhetskopi'))}</a>`;
    }
    function status() { const s = barEl && barEl.querySelector('.dk-st'); if (!s) return; const st = A.statusShort(); s.title = st.title || ''; s.innerHTML = `<i class="kept ${st.c}"></i><span>${esc(st.s)}</span>`; }
    const railCollapsed = () => !!(A.M.deskRail && A.M.deskRail.c);
    function setRail(c) { A.M.deskRail = Object.assign({}, A.M.deskRail || {}, { c: !!c }); A.saveMeta(); drawRail(); drawBar(); }

    /* ---------- the library rail ---------- */
    let railQ = '';
    const SECS = () => [
      ['aircraft', t('Aircraft', 'Fly'), 'aircraft', A.aircraft().map(a => ({ k: 'aircraft', r: a.id, n: a.reg || A.acName(a), s: a.reg ? a.type : '' }))],
      ['doc', t('Documents', 'Dokumenter'), 'doc', [{ k: 'ask', r: 'ask', n: t('Ask your documents', 'Spør dokumentene'), i: 'ask', soon: 1, cmd: 1 }].concat(A.docsAll().map(d => ({ k: 'doc', r: d.id, n: d.name, s: A.catName(d.cat), i: docKind(d), off: !A.onDevice(d.id) })))],
      ['note', t('Notes', 'Notater'), 'note', A.notebooksAll().map(n => ({ k: 'notebook', r: n.id, n: n.title || t('Notebook', 'Notatbok'), s: t('Notebook', 'Notatbok') })).concat(A.notesAll().map(n => ({ k: 'note', r: n.id, n: A.noteTitle(n), pin: n.pinned })))],
      ['pack', t('Briefing packs', 'Briefingpakker'), 'pack', A.packsAll().map(p => ({ k: 'pack', r: p.id, n: A.packTitle(p), s: (p.f || {}).date || '' }))],
      ['route', t('Routes', 'Ruter'), 'route', S.routes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(x => ({ k: 'route', r: x.id, n: A.routeTitle(x) }))]
    ];
    const secOpen = k => { const o = (A.M.deskRail || {}).open || {}; return o[k] !== false; };
    function railHtml(sheet) {
      const q = railQ.trim(), tk = W.tokens(q), openNow = new Set(D.allTabs(L).map(x => x.k + ':' + x.r));
      const match = it => !tk.length || tk.every(x => W.fold(it.n + ' ' + (it.s || '')).includes(x));
      const secs = SECS().map(([k, name, icon, list]) => {
        const l = list.filter(match); if (q && !l.length) return '';
        const open = q ? true : secOpen(k);
        return `<section class="dk-sec"><button type="button" class="dk-sh" data-sec="${k}" aria-expanded="${open}">${ic('chev', 'cv')}<span>${esc(name)}</span><span class="c">${list.filter(x => !x.soon).length}</span></button>
          ${open ? `<ul>${l.length ? l.map(it => `<li><button type="button" class="dk-it${openNow.has(it.k + ':' + it.r) ? ' open' : ''}${it.cmd ? ' cmd' : ''}" data-k="${it.k}" data-r="${esc(it.r)}" title="${esc(it.n)}">${ic(it.i || TYPES[it.k].icon(it.r))}<span class="n">${it.pin ? '<i class="pin"></i>' : ''}${esc(it.n)}</span>${it.off ? `<span class="off" title="${esc(t('File not on this device', 'Filen er ikke på denne enheten'))}">○</span>` : ''}</button></li>`).join('') : `<li class="none">${esc(k === 'doc' ? t('No documents yet', 'Ingen dokumenter ennå') : k === 'aircraft' ? t('No aircraft yet', 'Ingen fly ennå') : t('Nothing here yet', 'Ingenting her ennå'))}</li>`}</ul>` : ''}</section>`;
      }).join('');
      return `<div class="dk-rs"><label class="sr" for="dkQ${sheet ? 's' : ''}">${esc(t('Filter the library', 'Filtrer biblioteket'))}</label>${ic('search')}<input id="dkQ${sheet ? 's' : ''}" type="search" value="${esc(railQ)}" placeholder="${esc(t('Filter the library', 'Filtrer biblioteket'))}" autocomplete="off" spellcheck="false"></div>
        <div class="dk-tree">${secs || `<p class="dk-none">${esc(t('Nothing matches.', 'Ingen treff.'))}</p>`}</div>
        <div class="dk-rf"><button type="button" class="dk-add" data-b="add-doc">${ic('plus')}${esc(t('Add documents', 'Legg til dokumenter'))}</button><button type="button" class="dk-add" data-b="new-note">${ic('plus')}${esc(t('New note', 'Nytt notat'))}</button><button type="button" class="dk-add" data-b="new-nb">${ic('plus')}${esc(t('New notebook', 'Ny notatbok'))}</button></div>`;
    }
    function drawRail() {
      if (!railEl) return;
      const col = railCollapsed() && !isPhone();
      railEl.classList.toggle('col', col);
      if (col) {
        railEl.innerHTML = SECS().map(([k, name, icon, list]) => `<button type="button" class="dk-ri" data-ri="${k}" title="${esc(name)}" aria-label="${esc(name)}">${ic(icon)}<span class="c">${list.filter(x => !x.soon).length || ''}</span></button>`).join('') + `<span class="sp"></span><button type="button" class="dk-ri" data-b="add-doc" title="${esc(t('Add documents', 'Legg til dokumenter'))}" aria-label="${esc(t('Add documents', 'Legg til dokumenter'))}">${ic('plus')}</button>`;
      } else {
        const a = document.activeElement, had = a && a.id === 'dkQ', pos = had ? a.selectionStart : 0, sc = (railEl.querySelector('.dk-tree') || {}).scrollTop || 0;
        railEl.innerHTML = railHtml(false);
        const tr = railEl.querySelector('.dk-tree'); if (tr) tr.scrollTop = sc;
        if (had) { const q = railEl.querySelector('#dkQ'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} }
      }
      if (sheetEl && !sheetEl.hidden) drawSheet();
    }
    function drawSheet() {
      const c = sheetEl.querySelector('.dk-sheet-c'), a = document.activeElement, had = a && a.id === 'dkQs', pos = had ? a.selectionStart : 0;
      c.innerHTML = railHtml(true);
      if (had) { const q = c.querySelector('#dkQs'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} }
    }
    function openSheet() { if (!sheetEl) return; sheetEl.hidden = false; drawSheet(); requestAnimationFrame(() => sheetEl.classList.add('in')); }
    function closeSheet() { if (!sheetEl || sheetEl.hidden) return; sheetEl.classList.remove('in'); sheetEl.hidden = true; }

    /* ---------- panes ---------- */
    function keyOf(n) { return n.t === 'p' ? n.id : n.id + n.d + '(' + n.c.map(keyOf).join(',') + ')' + n.w.map(x => x.toFixed(3)).join(','); }
    function render(force) {
      if (!mounted) return;
      const ph = isPhone(), key = ph ? 'phone' : keyOf(L.root);
      if (force || key !== treeKey || ph !== phoneMode) {
        const keep = captureScroll();
        if (ph !== phoneMode) unmountViews();
        phoneMode = ph; treeKey = key;
        const want = new Set(ph ? ['phone'] : D.panes(L).map(p => p.id));
        panesEl.forEach((pe, id) => { if (!want.has(id)) { if (pe.view) destroyView(pe); panesEl.delete(id); } });
        mainEl.replaceChildren(ph ? paneEl('phone').el : build(L.root));
        mainEl.classList.toggle('phone', ph);
        restoreScroll(keep);
      }
      updatePanes();
      drawBarState();
    }
    function drawBarState() { if (!barEl) return; barEl.querySelectorAll('[data-b^="split"]').forEach(b => { b.disabled = D.panes(L).length >= maxPanes(); }); }
    function build(n) {
      if (n.t === 'p') return paneEl(n.id).el;
      const s = h('div', 'dk-s ' + (n.d === 'v' ? 'dk-v' : 'dk-h')); s.dataset.s = n.id;
      n.c.forEach((c, i) => {
        const k = build(c); k.style.flex = n.w[i] + ' 1 0px'; s.appendChild(k);
        if (i < n.c.length - 1) { const sp = h('div', 'dk-sp'); sp.setAttribute('role', 'separator'); sp.tabIndex = 0; sp.setAttribute('aria-orientation', n.d === 'v' ? 'horizontal' : 'vertical'); sp.setAttribute('aria-valuenow', Math.round(n.w[i] * 100)); sp.setAttribute('aria-valuemin', '14'); sp.setAttribute('aria-valuemax', '86'); sp.setAttribute('aria-label', t('Resize panes', 'Endre størrelse på panelene')); sp.dataset.s = n.id; sp.dataset.i = i; s.appendChild(sp); }
      });
      return s;
    }
    function paneEl(id) {
      let pe = panesEl.get(id); if (pe) return pe;
      const el = h('section', 'dk-pane'); el.dataset.pane = id;
      const strip = h('div', 'dk-strip'), body = h('div', 'dk-pb');
      el.append(strip, body); pe = { el, strip, body, view: null }; panesEl.set(id, pe); return pe;
    }
    /* the pane the user sees: on a phone, one pane holding every tab of the desk */
    function shown() {
      if (phoneMode) { const tabs = D.allTabs(L), at = D.activeTab(L) || tabs[0] || null; return [{ id: 'phone', tabs, a: at ? at.id : null, real: false }]; }
      return D.panes(L).map(p => ({ id: p.id, tabs: p.tabs, a: p.a, real: true }));
    }
    function updatePanes() {
      const list = shown(), many = list.length > 1, emptyDesk = !D.allTabs(L).length && D.panes(L).length === 1;
      list.forEach(p => {
        const pe = paneEl(p.id), tab = p.tabs.find(x => x.id === p.a) || null;
        pe.el.classList.toggle('act', many && p.id === L.act);
        pe.el.classList.toggle('empty', !tab);
        drawStrip(pe, p, emptyDesk);
        const want = tab ? tab.id : emptyDesk ? '#desk' : '#pane';
        if (pe.view && pe.view.tabId === want && pe.view.k === (tab ? tab.k : want) && !(pe.view.v.refresh && pe.view.v.refresh() === 'remount')) return;
        if (pe.view) destroyView(pe);
        pe.body.innerHTML = '';
        let v;
        if (!tab) v = emptyDesk ? mountEmptyDesk(pe.body) : mountEmptyPane(pe.body, p.id);
        else {
          const ctx = makeCtx(tab, p.real ? p.id : (D.paneOfTab(L, tab.id) || {}).id);
          try { v = typeOf(tab.k).mount(pe.body, tab, ctx) || {}; } catch (e) { console.error('desk view', e); pe.body.innerHTML = `<div class="dk-msg"><p>${esc(t('This item could not be shown.', 'Dette elementet kunne ikke vises.'))}</p></div>`; v = {}; }
          views.set(tab.id, v);
          if (tab.k === 'note') lastNoteTab = tab.id;
        }
        pe.view = { tabId: want, k: tab ? tab.k : want, v };
      });
      views.forEach(v => { if (v.ctxChanged) v.ctxChanged(); });
    }
    function destroyView(pe) {
      const cur = pe.view; pe.view = null; if (!cur) return;
      if (cur.v && cur.v.save && D.tabById(L, cur.tabId)) { const st = cur.v.save(); if (st) L = D.setState(L, cur.tabId, st); }
      try { cur.v && cur.v.destroy && cur.v.destroy(); } catch (e) {}
      if (views.get(cur.tabId) === cur.v) views.delete(cur.tabId);
    }
    function captureScroll() { const o = []; panesEl.forEach(pe => pe.body.querySelectorAll('[data-keep-scroll]').forEach(e => o.push([e, e.scrollTop, e.scrollLeft]))); return o; }
    function restoreScroll(o) { o.forEach(([e, y, x]) => { if (e.isConnected) { e.scrollTop = y; e.scrollLeft = x; } }); }
    function makeCtx(tab, paneId) {
      return { tabId: tab.id, paneId, st: tab.st || {},
        setSt: st => posChanged(tab.id, st),
        open: (k, r, o) => openItem(k, r, Object.assign({ pane: paneId }, o || {})),
        jumpTo: (docId, p) => jumpTo(docId, p, paneId),
        noteBeside: (docId, p, label) => noteBeside(docId, p, label, paneId),
        citeTarget: () => targetNote(paneId), cite: (docId, p, label) => citeInto(docId, p, label),
        quote: (html, docId) => quoteInto(html, docId, paneId), ask: docId => askBeside(docId, paneId),
        close: () => changed(D.close(L, tab.id, true), 'shape'),
        swipe: dir => switchTab(dir) };
    }
    function drawStrip(pe, p, emptyDesk) {
      const ph = phoneMode;
      if (emptyDesk) { pe.strip.innerHTML = ''; pe.strip.hidden = true; return; }
      pe.strip.hidden = false;
      const tabs = p.tabs.map((x, i) => { const T = typeOf(x.k), name = T.title(x.r), on = x.id === p.a;
        return `<div class="dk-tab${on ? ' on' : ''}${x.pin ? ' pinned' : ''}" role="tab" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-tab="${esc(x.id)}" title="${esc(name)}">${ic(T.icon(x.r))}<span class="tl">${esc(name)}</span>${x.pin ? `<span class="pn" title="${esc(t('Pinned', 'Festet'))}">${ic('pin')}</span>` : `<button type="button" class="x" data-x="${esc(x.id)}" tabindex="-1" aria-label="${esc(t('Close', 'Lukk') + ' ' + name)}">${ic('x')}</button>`}</div>`; }).join('');
      pe.strip.innerHTML = `<div class="dk-tabs" role="tablist" aria-label="${esc(t('Open items', 'Åpne elementer'))}">${tabs}</div>
        <div class="dk-pacts">${ph ? `<button type="button" class="dk-ib" data-b="switch" aria-label="${esc(t('Open tabs', 'Åpne faner'))}">${ic('tabs')}<span class="n">${p.tabs.length}</span></button>` : (p.tabs.length ? `<button type="button" class="dk-ib" data-pa="beside" title="${esc(t('Move this tab beside', 'Flytt fanen ved siden av'))}" aria-label="${esc(t('Move this tab beside', 'Flytt fanen ved siden av'))}"${p.tabs.length < 2 && D.panes(L).length >= maxPanes() ? ' disabled' : ''}>${ic('beside')}</button>` : '')}<button type="button" class="dk-ib" data-pa="menu" aria-haspopup="menu" aria-label="${esc(t('Pane options', 'Valg for panelet'))}">${ic('more')}</button></div>`;
      const on = pe.strip.querySelector('.dk-tab.on'), tl = pe.strip.querySelector('.dk-tabs');
      if (on && tl.scrollWidth > tl.clientWidth) { const l = on.offsetLeft, r = l + on.offsetWidth; if (l < tl.scrollLeft || r > tl.scrollLeft + tl.clientWidth) tl.scrollLeft = Math.max(0, l - 40); }
    }
    function switchTab(dir) {
      const p = phoneMode ? shown()[0] : D.activePane(L); if (!p || p.tabs.length < 2) return;
      const i = p.tabs.findIndex(x => x.id === p.a), nx = p.tabs[(i + dir + p.tabs.length) % p.tabs.length];
      activateTab(nx.id);
    }
    function activateTab(tabId) { const pp = D.paneOfTab(L, tabId); if (pp) changed(D.activate(L, pp.id, tabId), 'shape'); }
    function splitPane(paneId, dir) {
      const s = D.split(L, paneId || L.act, dir, maxPanes());
      if (!s) { A.toast(t('The desk has room for ' + maxPanes() + ' panes on this screen.', 'Arbeidsflaten har plass til ' + maxPanes() + ' paneler på denne skjermen.')); return; }
      changed(s.L, 'shape');
    }

    /* ---------- empty states ---------- */
    function mountEmptyDesk(box) {
      const rec = (A.M.recent || []).map(r => ({ k: r.t, r: r.id, at: r.at })).filter(x => TYPES[x.k] && live(x.k, x.r)).slice(0, 6);
      const now = new Date(), no = t('en', 'no') === 'no', h = now.getHours();
      const hello = h < 5 ? t('Good night', 'God natt') : h < 10 ? t('Good morning', 'God morgen') : h < 17 ? t('Good day', 'God dag') : h < 22 ? t('Good evening', 'God kveld') : t('Good night', 'God natt');
      const day = now.toLocaleDateString(no ? 'nb-NO' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const utc = String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0') + 'Z';
      const L3 = (en, no) => esc(t(en, no));
      const sketch = `<figure class="sk" aria-hidden="true">
        <svg viewBox="0 0 440 290" focusable="false">
          <defs><clipPath id="skc"><rect x="1" y="1" width="438" height="288" rx="12"/></clipPath>
            <pattern id="skg" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="gr"/></pattern></defs>
          <g clip-path="url(#skc)">
          <rect x="1" y="1" width="438" height="288" rx="12" class="win"/>
          <rect x="0" y="0" width="440" height="30" class="bar"/>
          <g class="tabs">
            <rect x="12" y="7" width="94" height="23" rx="4" class="tab on"/><text x="24" y="22">AFM · 4-12</text>
            <rect x="110" y="7" width="86" height="23" rx="4" class="tab"/><text x="122" y="22">${L3('Checklist', 'Sjekkliste')}</text>
            <rect x="200" y="7" width="86" height="23" rx="4" class="tab"/><text x="212" y="22">${L3('Notebook', 'Notatbok')}</text>
          </g>
          <!-- manual page -->
          <rect x="12" y="40" width="214" height="238" rx="6" class="pane"/>
          <rect x="26" y="52" width="186" height="226" class="pg"/>
          <text x="38" y="72" class="ph">4 · ${L3('NORMAL PROCEDURES', 'NORMALPROSEDYRER')}</text>
          <path d="M38 90h150M38 100h162M38 110h138" class="tl"/>
          <path d="M36 130h160" class="hl" pathLength="100"/>
          <text x="38" y="133" class="pt">${L3('Approach speed', 'Innflygingsfart')} ……… V<tspan dy="2" font-size="6">REF</tspan><tspan dy="-2"> + 5</tspan></text>
          <path d="M38 150h156M38 160h146M38 170h160M38 180h120" class="tl"/>
          <path d="M38 200h150M38 210h132M38 220h158M38 230h104M38 250h146M38 260h90" class="tl"/>
          <path d="M130 139c18 2 40 1 62-1" class="pen p0" pathLength="100"/>
          <!-- checklist -->
          <rect x="234" y="40" width="194" height="112" rx="6" class="pane"/>
          <text x="248" y="62" class="ph">${L3('BEFORE LANDING', 'FØR LANDING')}</text>
          <g class="ci"><rect x="248" y="74" width="10" height="10" rx="2" class="bx"/><text x="266" y="83">${L3('Landing gear', 'Understell')}</text><text x="414" y="83" class="r">DOWN · 3 GREEN</text><path d="M250 79l3 3 5-6" class="ck c1" pathLength="100"/></g>
          <g class="ci"><rect x="248" y="94" width="10" height="10" rx="2" class="bx"/><text x="266" y="103">${L3('Flaps', 'Flaps')}</text><text x="414" y="103" class="r">${L3('AS REQ', 'ETTER BEHOV')}</text><path d="M250 99l3 3 5-6" class="ck c2" pathLength="100"/></g>
          <g class="ci"><rect x="248" y="114" width="10" height="10" rx="2" class="bx"/><text x="266" y="123">${L3('Props', 'Propeller')}</text><text x="414" y="123" class="r">${L3('FULL FWD', 'HELT FREM')}</text><path d="M250 119l3 3 5-6" class="ck c3" pathLength="100"/></g>
          <g class="ci"><rect x="248" y="134" width="10" height="10" rx="2" class="bx"/><text x="266" y="143">${L3('Landing lights', 'Landingslys')}</text><text x="414" y="143" class="r">ON</text><path d="M250 139l3 3 5-6" class="ck c4" pathLength="100"/></g>
          <!-- notebook -->
          <rect x="234" y="160" width="194" height="118" rx="6" class="pane"/>
          <rect x="242" y="168" width="178" height="102" fill="url(#skg)" class="nbp"/>
          <path d="M378 192L410 175L414 182L382 199Z" class="pen p1" pathLength="100"/><path d="M386 192l20-10" class="pen p1 cl" pathLength="100"/>
          <path d="M262 252c26-12 56-28 82-41s22-10 32-14" class="pen p2" pathLength="100"/><circle cx="262" cy="252" r="3" class="dotp"/>
          
          <text x="300" y="236" class="hw">3°</text>
          <g class="chip"><rect x="250" y="176" width="74" height="16" rx="8"/><text x="259" y="187">↗ AFM ${L3('p.', 's.')} 4-12</text></g>
          </g>
        </svg>
      </figure>`;
      /* with five or more items of their own, a small live map of them takes the place of the drawing */
      const ma = !isPhone() && window.WSMAP && A.mapAny ? A.mapAny() : null, mg = ma ? ma.g : null, useMap = !!mg;
      const mini = useMap ? `<a class="sk mm" href="#/map" aria-label="${esc(t('Open the map of your workspace', 'Åpne kartet over arbeidsområdet'))}"><span class="mmh"></span><span class="mmc"><span>${ma && ma.sample ? esc(t('Example: how your map will look', 'Eksempel: slik blir kartet ditt')) : `${esc(t('Your workspace', 'Arbeidsområdet ditt'))} · <b>${mg.own}</b> ${esc(t('items', 'elementer'))}`}</span><span class="go">${esc(t('Open the map', 'Åpne kartet'))} →</span></span></a>` : '';
      box.innerHTML = `<div class="dk-empty" data-keep-scroll><div class="in">
        <div class="hero"><div class="tx">
        <p class="eb"><span>${esc(desk.name)}</span><span class="dot">·</span><span>${esc(day)}</span><span class="dot">·</span><span>${utc}</span></p>
        <h2>${esc(hello)}.<br><span>${esc(t('Your desk is ready.', 'Skrivebordet ditt er klart.'))}</span></h2>
        <p class="lead">${esc(t('Manual, checklist and notes side by side, exactly where you left them. Everything you need to prepare, nothing you don’t.', 'Manual, sjekkliste og notater side om side, akkurat der du slapp. Alt du trenger for å forberede deg, ingenting du ikke trenger.'))}</p>
        </div>${isPhone() ? '' : useMap ? mini : sketch}</div>
        <div class="big3">
          <button type="button" data-e="doc">${ic('pdf')}<b>${esc(t('Open document', 'Åpne dokument'))}</b><small>${esc(A.docsAll().length ? t('AFM, checklist, SOP or chart', 'AFM, sjekkliste, SOP eller kart') : t('Add a PDF, Word or text file', 'Legg til en PDF-, Word- eller tekstfil'))}</small></button>
          <button type="button" data-e="note">${ic('note')}<b>${esc(t('New note', 'Nytt notat'))}</b><small>${esc(t('Saved as you type', 'Lagres mens du skriver'))}</small></button>
          <button type="button" data-e="ac">${ic('aircraft')}<b>${esc(t('Choose aircraft', 'Velg fly'))}</b><small>${esc(A.aircraft().length ? t('Speeds, limits and its documents', 'Hastigheter, grenser og dokumentene') : t('Add the aircraft you fly', 'Legg til flyet du flyr'))}</small></button>
        </div>
        <div class="more2"><button type="button" data-e="nb">${ic('pen')}<span>${esc(t('New notebook', 'Ny notatbok'))}</span><small>${esc(t('Write with a pen on grid or lined paper, or an approach briefing', 'Skriv med penn på rutenett, linjer eller en innflygingsbrief'))}</small></button><button type="button" data-e="ask">${ic('ask')}<span>${esc(t('Ask your documents', 'Spør dokumentene'))}</span><small>${esc(t('Answers with the page they came from', 'Svar med siden de kom fra'))}</small></button><button type="button" data-e="map">${ic('map')}<span>${esc(t('Map', 'Kart'))}</span><small>${esc(t('See how your documents, notes and flights connect', 'Se hvordan dokumenter, notater og turer henger sammen'))}</small></button></div>
        ${rec.length ? `<h3>${esc(t('Recently opened', 'Sist åpnet'))}</h3><ul class="rec">${rec.map(x => `<li><button type="button" data-k="${x.k}" data-r="${esc(x.r)}">${ic(TYPES[x.k].icon(x.r))}<span class="n">${esc(TYPES[x.k].title(x.r))}</span><span class="w">${esc(A.ago(x.at))}</span></button></li>`).join('')}</ul>` : ''}
        <ul class="vals">
          <li>${ic('keep')}<div><b>${esc(t('Nothing gets lost', 'Ingenting går tapt'))}</b><span>${esc(t('Saved as you work, with history and a 30-day trash.', 'Lagres mens du jobber, med historikk og 30 dagers papirkurv.'))}</span></div></li>
          <li>${ic('resume')}<div><b>${esc(t('Pick up where you left off', 'Fortsett der du slapp'))}</b><span>${esc(t('Every tab, page and split comes back as it was.', 'Hver fane, side og deling kommer tilbake som den var.'))}</span></div></li>
          <li>${ic('device')}<div><b>${esc(t('Your material stays yours', 'Materialet ditt er ditt'))}</b><span>${esc(t('Manuals and PDFs stay on your device and are never uploaded.', 'Manualer og PDF-er blir på enheten din og lastes aldri opp.'))}</span></div></li>
        </ul>
        <p class="tip">${isPhone() ? esc(t('Tip: the library button at the top opens everything you have.', 'Tips: bibliotekknappen øverst åpner alt du har.')) : `<kbd>${KEY}</kbd> ${esc(t('opens anything. Drag an item from the library to place it beside another.', 'åpner hva som helst. Dra et element fra biblioteket for å legge det ved siden av et annet.'))}`}</p>
      </div></div>`;
      box.querySelector('.big3').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) emptyAction(b.dataset.e); });
      box.querySelector('.more2').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) emptyAction(b.dataset.e); });
      let mm = null; const mh = box.querySelector('.mmh');
      if (mh) { try { mm = window.WSMAP.mount(mh, { graph: mg, t, mini: true, sample: !!(ma && ma.sample) }); } catch (e) { console.error('mini map', e); } }
      const sig = g => g ? g.nodes.length + ':' + g.links.length : '';
      return { destroy: () => { if (mm) mm.destroy(); mm = null; },
        refresh: () => { if (!A.mapGraph) return ''; const na = !isPhone() && window.WSMAP && A.mapAny ? A.mapAny() : null; if (!!na !== useMap || (na && ma && na.sample !== ma.sample)) return 'remount'; if (mm && na && sig(na.g) !== sig(mm.graph)) mm.setGraph(na.g); return ''; } };
    }
    function emptyAction(k, paneId) {
      if (k === 'doc') { if (A.docsAll().length) palette({ only: 'doc', pane: paneId }); else A.pickFiles({}); }
      else if (k === 'note') newNote({}, { pane: paneId });
      else if (k === 'nb') newNotebook({ pane: paneId });
      else if (k === 'ask') askBeside(null, paneId);
      else if (k === 'map') A.go('map');
      else if (k === 'ac') { if (A.aircraft().length) palette({ only: 'aircraft', pane: paneId }); else A.aircraftDlg(null).then(id => { if (id) openItem('aircraft', id, { pane: paneId }); }); }
    }
    function mountEmptyPane(box, paneId) {
      box.innerHTML = `<div class="dk-epane"><p>${esc(t('An empty pane. Drag a tab or a library item here, or:', 'Et tomt panel. Dra en fane eller et element fra biblioteket hit, eller:'))}</p>
        <div class="row"><button type="button" class="btn sm" data-e="open">${ic('search')}${esc(t('Open…', 'Åpne …'))}</button><button type="button" class="btn sm" data-e="note">${ic('note')}${esc(t('New note', 'Nytt notat'))}</button><button type="button" class="btn sm" data-e="nb">${ic('pen')}${esc(t('New notebook', 'Ny notatbok'))}</button><button type="button" class="btn sm quiet" data-e="close">${esc(t('Close pane', 'Lukk panelet'))}</button></div></div>`;
      box.querySelector('.row').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (!b) return;
        if (b.dataset.e === 'open') palette({ pane: paneId }); else if (b.dataset.e === 'note') newNote({}, { pane: paneId }); else if (b.dataset.e === 'nb') newNotebook({ pane: paneId }); else changed(D.removePane(L, paneId), 'shape'); });
      return {};
    }
    function live(k, r) { if (k === 'pack') return !!findPack(r); if (k === 'route') return !!findRoute(r); if (k === 'ask') return true; return W.isLive(A.item(r)); }
    function missing(box, k, r, ctx) {
      const it = A.item(r), trashed = it && W.inTrash(it);
      box.innerHTML = `<div class="dk-msg"><p><b>${esc(trashed ? t('This item is in the trash.', 'Dette elementet ligger i papirkurven.') : t('This item is not here.', 'Dette elementet finnes ikke her.'))}</b></p><p>${esc(trashed ? t('Restore it to keep working on it here.', 'Gjenopprett det for å fortsette å jobbe med det her.') : t('It may have been deleted, or it has not reached this device yet.', 'Det kan være slettet, eller det har ikke kommet til denne enheten ennå.'))}</p>
        <p class="row">${trashed ? `<button type="button" class="btn sm pri" data-m="restore">${esc(t('Restore', 'Gjenopprett'))}</button>` : ''}<button type="button" class="btn sm" data-m="close">${esc(t('Close tab', 'Lukk fanen'))}</button></p></div>`;
      box.querySelector('.row').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; if (b.dataset.m === 'restore') A.doRestore(r); else ctx.close(); });
      return { refresh: () => live(k, r) ? 'remount' : '' };
    }

    /* ---------- document viewer: PDF (lazy pages), image, or the text found in it ---------- */
    const pdfCache = new Map();         // doc id -> { p: Promise<{ pdf, labels }>, users, at }
    function getPdf(id, blob) {
      let e = pdfCache.get(id);
      if (!e) { e = { users: 0, at: 0, labels: null, p: (async () => { const lib = await A.pdfjs(); const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; let labels = null; try { labels = await pdf.getPageLabels(); } catch (er) {} e.labels = labels; return { pdf, labels }; })() }; pdfCache.set(id, e); e.p.catch(() => pdfCache.delete(id)); }
      e.users++; e.at = Date.now(); return e.p;
    }
    function releasePdf(id) {
      const e = pdfCache.get(id); if (e) e.users = Math.max(0, e.users - 1);
      const idle = [...pdfCache.entries()].filter(([, x]) => !x.users).sort((a, b) => a[1].at - b[1].at);
      while (pdfCache.size > 3 && idle.length) { const [k, x] = idle.shift(); pdfCache.delete(k); x.p.then(r => { try { r.pdf.destroy(); } catch (er) {} }, () => {}); }
    }
    const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
    function mountDoc(box, tab, ctx) {
      const id = tab.r, d = A.item(id);
      if (!W.isLive(d)) return missing(box, 'doc', id, ctx);
      const sd = S.docs[id], pages = sd ? W.pagesFromChunks(sd.chunks) : [], hasText = pages.length > 0;
      let st = Object.assign({}, (A.M.docPos || {})[id] || {}, ctx.st), alive = true, mode = null, z = st.z || 1, cur = st.p || 1, total = 0, labels = null, ratio = 1.414, usesPdf = false;
      let wantFlash = false, pdf = null, obs = null, ro = null, url = null, lastW = 0, rT = 0, sT = 0, raf = 0, pgEls = [], liveC = [], find = { hits: [], q: '' }, ann = null;
      const root = h('div', 'dv' + (z > 1 ? ' zoomed' : '')); box.appendChild(root);
      const label = p => (labels && labels[p - 1]) || String(p);
      const paneW = () => sc ? sc.clientWidth : 600;
      root.innerHTML = `<div class="dv-bar" role="toolbar" aria-label="${esc(t('Document', 'Dokument'))}"></div><div class="dv-fbar" role="search" hidden></div><div class="dv-sc" tabindex="0" data-keep-scroll><p class="dk-wait">${esc(t('Opening…', 'Åpner …'))}</p></div>`;
      const bar = root.querySelector('.dv-bar'), fbar = root.querySelector('.dv-fbar'), sc = root.querySelector('.dv-sc');
      let findOpen = false;
      let fileKind = null;

      function drawBar() {
        const paged = mode === 'file' ? fileKind === 'pdf' : hasText, zoomable = mode === 'file';
        const tn = ctx.citeTarget();
        bar.innerHTML = `${paged ? `<div class="dv-nav"><button type="button" class="dk-ib" data-a="prev" aria-label="${esc(t('Previous page', 'Forrige side'))}">${ic('left')}</button><label class="dv-pg"><span class="sr">${esc(t('Page', 'Side'))}</span><input type="text" inputmode="numeric" enterkeyhint="go" value="${cur}" aria-label="${esc(t('Page', 'Side'))}"></label><span class="dv-of">/ ${mode === 'file' ? total : pages.length ? pages[pages.length - 1].p : 0}</span><span class="dv-lbl"></span><button type="button" class="dk-ib" data-a="next" aria-label="${esc(t('Next page', 'Neste side'))}">${ic('right')}</button></div>` : '<span></span>'}
          ${zoomable ? `<div class="dv-zoom"><button type="button" class="dk-ib" data-a="zout" aria-label="${esc(t('Zoom out', 'Zoom ut'))}">${ic('minus')}</button><button type="button" class="dv-z" data-a="zfit" title="${esc(t('Fit to width', 'Tilpass bredden'))}">${Math.round(z * 100)}%</button><button type="button" class="dk-ib" data-a="zin" aria-label="${esc(t('Zoom in', 'Zoom inn'))}">${ic('plus')}</button></div>` : ''}
          ${hasText ? `<button type="button" class="dk-ib dv-fb${findOpen ? ' on' : ''}" data-a="find" aria-expanded="${findOpen}" title="${esc(t('Find in document', 'Finn i dokumentet'))} (${isMac ? '⌘' : 'Ctrl '}F)" aria-label="${esc(t('Find in document', 'Finn i dokumentet'))}">${ic('search')}</button>` : ''}
          <span class="sp"></span>
          ${(fileKind && hasText) ? `<div class="seg dv-seg" role="group" aria-label="${esc(t('View', 'Visning'))}"><button type="button" data-vm="file" class="${mode === 'file' ? 'on' : ''}" aria-pressed="${mode === 'file'}">${fileKind === 'img' ? esc(t('Image', 'Bilde')) : 'PDF'}</button><button type="button" data-vm="text" class="${mode === 'text' ? 'on' : ''}" aria-pressed="${mode === 'text'}">${esc(t('Text', 'Tekst'))}</button></div>` : ''}
          ${paged && tn ? `<button type="button" class="btn sm dv-cite" data-a="cite" title="${esc(t('Add a reference to this page to the note beside', 'Legg en henvisning til denne siden inn i notatet ved siden av'))}">${ic('cite')}<span class="lb"></span></button>` : ''}
          ${mode === 'file' && fileKind === 'pdf' && window.WSNB ? `<button type="button" class="btn sm dv-ann${ann && ann.on ? ' on' : ''}" data-a="ann" aria-pressed="${!!(ann && ann.on)}" title="${esc(t('Write on the pages with a pen. The PDF itself is never changed.', 'Skriv på sidene med penn. Selve PDF-en endres aldri.'))}">${ic('pen')}<span>${esc(t('Annotate', 'Skriv på'))}</span></button>` : ''}
          ${hasText && window.WSASK ? `<button type="button" class="btn sm dv-ask" data-a="ask" title="${esc(t('Ask this document a question, with the page in the answer', 'Still dokumentet et spørsmål, med siden i svaret'))}">${ic('ask')}<span>${esc(t('Ask', 'Spør'))}</span></button>` : ''}
          ${paged ? `<button type="button" class="btn sm dv-nb" data-a="nb" title="${esc(t('Start a note beside this document, linked to this page', 'Start et notat ved siden av dokumentet, koblet til denne siden'))}">${ic('beside')}<span>${esc(t('Note beside', 'Notat ved siden av'))}</span></button>` : ''}
          <button type="button" class="dk-ib" data-a="more" aria-haspopup="menu" aria-label="${esc(t('More', 'Mer'))}">${ic('more')}</button>`;
        drawPageNo();
      }
      function drawFbar() {
        fbar.hidden = !findOpen; if (!findOpen) return;
        fbar.innerHTML = `<div class="dv-fin">${ic('search')}<input type="search" value="${esc(find.q)}" placeholder="${esc(t('Find in document', 'Finn i dokumentet'))}" aria-label="${esc(t('Find in document', 'Finn i dokumentet'))}" enterkeyhint="search"></div><span class="dv-fc" aria-live="polite"></span><button type="button" class="dk-ib" data-a="fprev" aria-label="${esc(t('Previous match', 'Forrige treff'))}" hidden>${ic('left')}</button><button type="button" class="dk-ib" data-a="fnext" aria-label="${esc(t('Next match', 'Neste treff'))}" hidden>${ic('right')}</button><span class="dv-hit"></span><button type="button" class="dk-ib" data-a="fclose" aria-label="${esc(t('Close find', 'Lukk søket'))}">${ic('x')}</button>`;
        drawFind();
      }
      function toggleFind(on) { findOpen = on; drawFbar(); const b = bar.querySelector('.dv-fb'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-expanded', on); } if (on) { const i = fbar.querySelector('input'); i.focus(); i.select(); } else { if (find.q) setFind(''); sc.focus({ preventScroll: true }); } }
      function drawPageNo() {
        const inp = bar.querySelector('.dv-pg input'); if (inp && document.activeElement !== inp) inp.value = cur;
        const lb = bar.querySelector('.dv-lbl'); if (lb) lb.textContent = labels && label(cur) !== String(cur) ? '(' + label(cur) + ')' : '';
        const cb = bar.querySelector('.dv-cite .lb'); if (cb) cb.textContent = t('Cite p. ', 'Henvis s. ') + label(cur);
        if (ann) ann.page(cur);
      }
      function drawFind() {
        const fc = fbar.querySelector('.dv-fc'); if (!fc) return;
        const n = find.hits.length, on = !!find.q.trim();
        fc.textContent = !on ? '' : n ? t(n === 1 ? '1 page' : n + ' pages', n === 1 ? '1 side' : n + ' sider') : t('No match', 'Ingen treff');
        fbar.querySelectorAll('[data-a="fprev"],[data-a="fnext"]').forEach(b => { b.hidden = !n; });
      }
      function setFind(q) {
        find.q = q; find.hits = q.trim() && sd ? D.findPages(sd.chunks, q, W.fold, W.tokens, W.snippet) : [];
        drawFind(); const hh = fbar.querySelector('.dv-hit'); if (hh) hh.innerHTML = '';
        if (mode === 'text') drawText();
      }
      function stepFind(dir) {
        const l = find.hits; if (!l.length) return;
        let x = dir > 0 ? l.find(h2 => h2.p > cur) || l[0] : [...l].reverse().find(h2 => h2.p < cur) || l[l.length - 1];
        goPage(x.p, 0, true);
        const hh = fbar.querySelector('.dv-hit'); if (hh) hh.innerHTML = `<b>${esc(t('p. ', 's. ') + label(x.p))}</b> ${mark(x.snippet, find.q)} <span class="ix">${l.indexOf(x) + 1} / ${l.length}</span>`;
      }
      const mark = (text, q) => { let s = esc(text); W.tokens(q).forEach(tk => { if (tk.length > 1) s = s.replace(new RegExp('(' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return s; };

      /* --- PDF --- */
      function pageW() { return Math.max(160, Math.round((paneW() - (isPhone() ? 16 : 32)) * z)); }
      function sizePages() {
        const w = pageW(); lastW = paneW();
        const wrap = sc.querySelector('.dv-pages'); if (wrap) wrap.style.width = w + 'px';
        pgEls.forEach(pg => { pg.style.height = Math.round(w * (pg._r || ratio)) + 'px'; });
      }
      function paint(pg) {
        const w = pageW(); if (!pdf || +pg.dataset.w === w || pg._busy) return;
        pg._busy = true;
        pdf.getPage(+pg.dataset.p).then(p => {
          if (!alive) return;
          const v0 = p.getViewport({ scale: 1 }); pg._r = v0.height / v0.width;
          const ww = pageW(), dpr = Math.min(2, window.devicePixelRatio || 1), vp = p.getViewport({ scale: Math.min(4, ww * dpr / v0.width) });
          const c = document.createElement('canvas'); c.className = 'pdfc'; c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          return p.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise.then(() => {
            if (!alive) return; const old = pg.querySelector('canvas.pdfc'); if (old) { old.width = old.height = 0; old.remove(); }
            pg.insertBefore(c, pg.firstChild); pg.dataset.w = ww; pg.style.height = Math.round(ww * pg._r) + 'px';
            if (ann) ann.paint(pg);
            const i = liveC.indexOf(pg); if (i >= 0) liveC.splice(i, 1); liveC.push(pg);
            while (liveC.length > 10) { const o = liveC.shift(); o.querySelectorAll('canvas').forEach(oc => { oc.width = oc.height = 0; oc.remove(); }); delete o.dataset.w; }
            p.cleanup();
          });
        }).catch(() => {}).then(() => { pg._busy = false; if (alive && +pg.dataset.w !== pageW() && pg._vis) paint(pg); });
      }
      async function showPdf(blob) {
        usesPdf = true;
        let r; try { r = await getPdf(id, blob); } catch (e) { usesPdf = false; releasePdf(id); if (alive) sc.innerHTML = `<div class="dk-msg"><p>${esc(t('This PDF could not be opened here. Download it to open it in another app.', 'Denne PDF-en kunne ikke åpnes her. Last den ned for å åpne den i en annen app.'))}${hasText ? ' ' + esc(t('The text view still works.', 'Tekstvisningen fungerer fortsatt.')) : ''}</p></div>`; return; }
        if (!alive) return;
        pdf = r.pdf; labels = r.labels; total = pdf.numPages; cur = Math.min(Math.max(1, cur), total);
        try { const p1 = await pdf.getPage(1); const v = p1.getViewport({ scale: 1 }); ratio = v.height / v.width; } catch (e) {}
        if (!alive) return;
        sc.innerHTML = `<div class="dv-pages">${Array.from({ length: total }, (_, i) => `<div class="pg" data-p="${i + 1}"><span class="no">${esc(label(i + 1))}</span></div>`).join('')}</div>`;
        pgEls = [...sc.querySelectorAll('.pg')];
        if (window.WSNB && !ann) ann = window.WSNB.annotator({ docId: id, sc, root, bar, pages: () => pgEls, ratio: () => ratio, cur: () => cur, zoom: s => rezoom(z * s), onToggle: () => drawBar() });
        sizePages(); drawBar();
        obs = new IntersectionObserver(es => es.forEach(e => { e.target._vis = e.isIntersecting; if (e.isIntersecting) paint(e.target); }), { root: sc, rootMargin: '800px 0px' });
        pgEls.forEach(pg => obs.observe(pg));
        goPage(cur, st.o || 0, wantFlash); wantFlash = false;
      }
      function rezoom(nz) {
        const keep = where(); z = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], nz));
        if (fileKind === 'pdf') { sizePages(); goPage(keep.p, keep.o); pgEls.forEach(pg => { if (pg._vis) paint(pg); }); }
        else if (fileKind === 'img') { const im = sc.querySelector('img'); if (im) im.style.width = Math.round((paneW() - 32) * z) + 'px'; }
        const zb = bar.querySelector('.dv-z'); if (zb) zb.textContent = Math.round(z * 100) + '%'; root.classList.toggle('zoomed', z > 1);
        save(); ctx.setSt({ z });
      }
      /* where the reader is: page and how far down it (0..1) */
      function where() {
        const els = mode === 'file' ? pgEls : [...sc.querySelectorAll('.dv-tp')]; if (!els.length) return { p: cur, o: 0 };
        const y = sc.scrollTop + 12; let lo = 0, hi = els.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (els[mid].offsetTop <= y) lo = mid; else hi = mid - 1; }
        const e = els[lo], o = Math.max(0, Math.min(1, (y - e.offsetTop) / Math.max(1, e.offsetHeight)));
        return { p: +e.dataset.p, o };
      }
      function goPage(p, o, flash) {
        if (mode === 'file' && fileKind === 'pdf') {
          p = Math.max(1, Math.min(total || 1, Math.round(+p || 1))); const pg = pgEls[p - 1]; if (!pg) return;
          sc.scrollTop = Math.max(0, pg.offsetTop - 12 + (o || 0) * pg.offsetHeight);
          if (flash) { pg.classList.remove('flash'); void pg.offsetWidth; pg.classList.add('flash'); }
        } else if (mode === 'text') {
          const s = sc.querySelector(`.dv-tp[data-p="${Math.round(+p)}"]`) || [...sc.querySelectorAll('.dv-tp')].find(x => +x.dataset.p >= p);
          if (s) { sc.scrollTop = Math.max(0, s.offsetTop - 12 + (o || 0) * s.offsetHeight); if (flash) { s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); } }
        } else return;
        cur = Math.round(+p) || 1; drawPageNo(); save();
      }
      function onScroll() {
        if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!alive) return; const w = where(); if (w.p !== cur) { cur = w.p; drawPageNo(); } clearTimeout(sT); sT = setTimeout(save, 400); });
      }
      function save() { if (!alive || !mode) return; const w = mode === 'img' ? { p: 1, o: 0 } : where(); const s = { p: w.p, o: w.o, z, v: mode }; A.M.docPos = A.M.docPos || {}; A.M.docPos[id] = { p: s.p, z }; trimPos(); ctx.setSt(s); return s; }

      /* --- text --- */
      function drawText() {
        const keep = mode === 'text' && sc.querySelector('.dv-tp') ? where() : { p: cur, o: st.o || 0 };
        sc.innerHTML = hasText ? `<div class="dv-txt">${pages.map(p => `<section class="dv-tp" data-p="${p.p}"><h4>${esc(t('Page ', 'Side ') + p.p)}${p.s ? ' · ' + esc(p.s) : ''}</h4><p>${find.q.trim() ? mark(p.t, find.q) : esc(p.t)}</p></section>`).join('')}</div>`
          : `<div class="dk-msg"><p>${esc(t('This file has no text Birdbird can show (it may be scanned or protected). Download it to open it in another app.', 'Denne filen har ingen tekst Birdbird kan vise (den kan være skannet eller beskyttet). Last den ned for å åpne den i en annen app.'))}</p></div>`;
        goPage(keep.p, keep.o);
      }
      async function setMode(m) {
        if (mode === m) return; const keep = mode ? where() : { p: cur, o: st.o || 0 }; mode = m; cur = keep.p; st.o = keep.o;
        if (obs) { obs.disconnect(); obs = null; } pgEls = []; liveC = [];
        if (ann) { if (ann.on) ann.toggle(false); ann.destroy(); ann = null; }
        if (m === 'text') { drawBar(); drawText(); if (wantFlash) { goPage(cur, st.o || 0, true); wantFlash = false; } save(); return; }
        const blob = await A.FI.getBlob(id); if (!alive) return;
        if (fileKind === 'img') { url = url || URL.createObjectURL(blob); sc.innerHTML = `<div class="dv-img"><img src="${url}" alt="${esc(d.name)}" style="width:${Math.round((paneW() - 32) * z)}px"></div>`; drawBar(); }
        else { sc.innerHTML = `<p class="dk-wait">${esc(t('Opening the PDF…', 'Åpner PDF-en …'))}</p>`; drawBar(); await showPdf(blob); }
        save();
      }
      (async () => {
        if (!sd) {
          sc.innerHTML = `<div class="dk-msg"><p><b>${esc(t('The file is not on this device.', 'Filen er ikke på denne enheten.'))}</b></p><p>${esc(t('Your account keeps this document’s name and links, never the file itself. Add the file again on this device, or import a backup file.', 'Kontoen din tar vare på navnet og koblingene til dokumentet, aldri selve filen. Legg til filen på nytt på denne enheten, eller importer en sikkerhetskopi.'))}</p><p><button type="button" class="btn sm pri" data-act="doc-file" data-id="${esc(id)}">${esc(t('Add the file', 'Legg til filen'))}</button></p></div>`;
          bar.innerHTML = '<span class="sp"></span>'; return;
        }
        const blob = A.hasFile(id) ? await A.FI.getBlob(id) : null; if (!alive) return;
        fileKind = blob ? ((d.ext === 'pdf' || blob.type === 'application/pdf' || sd.blob) ? 'pdf' : /^image\//.test(blob.type) ? 'img' : null) : null;
        const want = st.v === 'text' && hasText ? 'text' : fileKind ? 'file' : 'text';
        await setMode(want);
      })();

      sc.addEventListener('scroll', onScroll, { passive: true });
      ro = new ResizeObserver(() => { if (!alive || Math.abs(paneW() - lastW) < 3) return; clearTimeout(rT); rT = setTimeout(() => { if (!alive) return; if (fileKind === 'pdf' && mode === 'file') { const k = where(); sizePages(); goPage(k.p, k.o); pgEls.forEach(pg => { if (pg._vis) paint(pg); }); } else if (fileKind === 'img' && mode === 'file') rezoom(z); lastW = paneW(); }, 120); });
      ro.observe(sc);
      let fT = 0;
      fbar.addEventListener('input', e => { if (e.target.type === 'search') { clearTimeout(fT); const q = e.target.value; fT = setTimeout(() => setFind(q), 220); } });
      fbar.addEventListener('keydown', e => {
        if (e.target.type === 'search') { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(fT); if (find.q !== e.target.value) setFind(e.target.value); stepFind(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); toggleFind(false); } e.stopPropagation(); }
      });
      fbar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'fnext') stepFind(1); else if (b.dataset.a === 'fprev') stepFind(-1); else if (b.dataset.a === 'fclose') toggleFind(false); });
      root.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F') && hasText) { e.preventDefault(); toggleFind(true); } });
      bar.addEventListener('keydown', e => {
        if (e.target.closest('.dv-pg')) { if (e.key === 'Enter') { e.preventDefault(); goPage(+e.target.value || cur, 0, true); e.target.blur(); } e.stopPropagation(); }
      });
      bar.addEventListener('change', e => { if (e.target.closest('.dv-pg')) goPage(+e.target.value || cur, 0, true); });
      bar.addEventListener('click', e => {
        const vm = e.target.closest('[data-vm]'); if (vm) { setMode(vm.dataset.vm === 'text' ? 'text' : 'file'); return; }
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
        if (a === 'prev') goPage(cur - 1); else if (a === 'next') goPage(cur + 1);
        else if (a === 'zin') rezoom(ZOOMS.find(x => x > z + 1e-3) || z); else if (a === 'zout') rezoom([...ZOOMS].reverse().find(x => x < z - 1e-3) || z); else if (a === 'zfit') rezoom(1);
        else if (a === 'find') toggleFind(!findOpen);
        else if (a === 'nb') ctx.noteBeside(id, cur, label(cur));
        else if (a === 'cite') ctx.cite(id, cur, label(cur));
        else if (a === 'ann') { if (ann) ann.toggle(); }
        else if (a === 'ask') ctx.ask(id);
        else if (a === 'more') menu(b, [
          { l: t('Note beside', 'Notat ved siden av'), f: () => ctx.noteBeside(id, cur, label(cur)), hide: !(mode === 'file' ? fileKind === 'pdf' : hasText) },
          { l: t('Export with your ink (PDF)', 'Eksporter med blekket ditt (PDF)'), f: () => { if (ann && pdf) ann.exportPdf(pdf, d.name); }, hide: !(ann && pdf && ann.any()) },
          A.hasFile(id) ? { l: t('Download the file', 'Last ned filen'), f: async () => { const bl = await A.FI.getBlob(id); if (bl) A.download(bl, (sd.file && sd.file.name) || d.name + '.' + (d.ext || 'pdf')); } } : null,
          ...(A.ockCan && A.ockCan(d) && hasText ? A.OCK_TR.map(([ty, pg]) => ({ l: t('Use in the ' + ty + ' trainer', 'Bruk i ' + ty + '-treneren'), f: () => { A.useInTrainer(ty, id); location.href = pg; } })).concat([{ sep: 1 }]) : []),
          { l: t('Name, category and links…', 'Navn, kategori og koblinger …'), f: () => A.go('documents/' + id) },
          { l: t('Replace the file…', 'Bytt ut filen …'), f: () => A.pickFiles({ replaceId: id }) },
          { sep: 1 }, { l: t('Move to trash', 'Flytt til papirkurv'), f: () => A.doTrash(id), danger: 1 }]);
      });
      if (phoneMode) swipeable(sc, () => (z <= 1 || fileKind !== 'pdf') && !(ann && ann.on), ctx);
      return {
        save, goPage: (p, o, fl) => { if (mode && (mode === 'text' || pgEls.length)) goPage(p, o, fl); else { cur = Math.round(+p) || 1; st.o = o || 0; wantFlash = !!fl; } },
        ctxChanged() { if (!mode) return; const has = !!bar.querySelector('.dv-cite'), want = !!ctx.citeTarget() && (mode === 'file' ? fileKind === 'pdf' : hasText); if (has !== want) drawBar(); },
        refresh() { const dd = A.item(id); if (!W.isLive(dd) || (!sd && S.docs[id])) return 'remount'; if (dd.name !== d.name) { d.name = dd.name; } if (ann) ann.refresh(); },
        pos() { return mode ? { p: cur, paged: mode === 'file' ? fileKind === 'pdf' : hasText } : null; },
        destroy() { if (mode) save(); alive = false; if (ann) ann.destroy(); if (obs) obs.disconnect(); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); if (url) URL.revokeObjectURL(url); liveC.forEach(pg => { const c = pg.querySelector('canvas'); if (c) { c.width = c.height = 0; } }); if (usesPdf) releasePdf(id); }
      };
    }
    function trimPos() { const o = A.M.docPos; const k = Object.keys(o); if (k.length > 120) k.slice(0, k.length - 120).forEach(x => delete o[x]); clearTimeout(trimPos.t); trimPos.t = setTimeout(A.saveMeta, 1500); }
    /* phone: swipe sideways on a view to go to the next or previous tab */
    function swipeable(el, ok, ctx) {
      let s = null;
      el.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || !ok()) { s = null; return; } s = { x: e.clientX, y: e.clientY, t: Date.now() }; }, { passive: true });
      el.addEventListener('pointerup', e => { if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y; if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - s.t < 600) ctx.swipe(dx < 0 ? 1 : -1); s = null; }, { passive: true });
      el.addEventListener('pointercancel', () => { s = null; }, { passive: true });
    }

    /* ---------- note ---------- */
    function mountNote(box, tab, ctx) {
      const id = tab.r; let n = A.item(id);
      if (!W.isLive(n) || n.kind !== 'note') return missing(box, 'note', id, ctx);
      const fmt = A.noteFormats[n.fmt || 'text'];
      if (fmt && fmt.open) { const r = h('div', 'nv'); box.appendChild(r); fmt.open(n, r, f => { n = W.editNote(A.item(id) || n, f); A.commit(n); }); return {}; }
      const root = h('div', 'nv'); box.appendChild(root);
      const fb = (cmd, label, html, arg) => `<button type="button" data-cmd="${cmd}"${arg ? ` data-arg="${arg}"` : ''} title="${esc(label)}" aria-label="${esc(label)}">${html}</button>`;
      root.innerHTML = `<div class="nv-bar" role="toolbar" aria-label="${esc(t('Formatting', 'Formatering'))}">${fb('bold', t('Bold', 'Fet'), '<b>B</b>')}${fb('italic', t('Italic', 'Kursiv'), '<i>I</i>')}${fb('mark', t('Highlight', 'Uthev'), '<mark>' + esc(t('Mark', 'Uthev')) + '</mark>')}<span class="sep"></span>${fb('formatBlock', t('Heading', 'Overskrift'), 'H', 'h3')}${fb('insertUnorderedList', t('Bulleted list', 'Punktliste'), '•&#8202;' + esc(t('List', 'Liste')))}${fb('insertOrderedList', t('Numbered list', 'Nummerert liste'), '1.&#8202;' + esc(t('List', 'Liste')))}<span class="sep"></span><button type="button" data-cmd="cite" class="nv-cite" title="${esc(t('Add a reference to the page open beside', 'Legg inn en henvisning til siden som er åpen ved siden av'))}" hidden>${ic('cite')}<span>${esc(t('Page ref', 'Sidehenv.'))}</span></button>
          <span class="sp"></span><span class="nv-saved" role="status"></span><button type="button" data-a="hist" class="nv-h">${esc(t('History', 'Historikk'))}</button><button type="button" class="dk-ib" data-a="more" aria-haspopup="menu" aria-label="${esc(t('More', 'Mer'))}">${ic('more')}</button></div>
        <div class="nv-sc" data-keep-scroll><div class="nv-pg"><input class="nv-ttl" maxlength="140" value="${esc(n.title)}" placeholder="${esc(t('Title', 'Tittel'))}" aria-label="${esc(t('Title', 'Tittel'))}"><div class="nv-links"></div>
          <div class="nv-bd" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(t('Note text', 'Notattekst'))}" data-ph="${esc(t('Write here. It is saved as you type.', 'Skriv her. Det lagres mens du skriver.'))}"></div></div></div>`;
      const bd = root.querySelector('.nv-bd'), ttl = root.querySelector('.nv-ttl'), sc = root.querySelector('.nv-sc'), saved = root.querySelector('.nv-saved'), links = root.querySelector('.nv-links');
      let lastRange = null, alive = true;
      const lock = () => bd.querySelectorAll('cite').forEach(c => { c.contentEditable = 'false'; if (c.dataset.doc) { c.tabIndex = 0; c.setAttribute('role', 'link'); c.title = t('Open this page', 'Åpne denne siden'); } });
      bd.innerHTML = n.body; lock();
      const stat = s => { saved.innerHTML = s ? `<span class="ok">${esc(t('Saved', 'Lagret'))}</span>` : esc(t('Edited ', 'Endret ') + A.ago(n.updatedAt)); };
      const save = f => { n = W.editNote(A.item(id) || n, f); A.commit(n); stat(true); if (f.title !== undefined) drawTabTitles(); if (f.links) drawLinks(); };
      function drawLinks() {
        const l = (n.links || []).map(x => ({ x, v: A.linkLabel(x) })).filter(o => o.v);
        links.innerHTML = l.map(o => o.x.t === 'lab' ? `<a class="chip" href="${esc(o.v.h)}">${esc(o.v.n)}</a>` : `<button type="button" class="chip" data-open="${o.x.t}:${esc(o.x.id)}">${ic(o.x.t === 'doc' ? 'pdf' : o.x.t)}<span>${esc(o.v.n)}</span></button>`).join('');
      }
      drawLinks(); stat(false);
      bd.addEventListener('input', () => save({ body: bd.innerHTML }));
      ttl.addEventListener('input', () => save({ title: ttl.value }));
      ttl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); bd.focus(); } });
      bd.addEventListener('paste', e => { e.preventDefault(); const tx = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, tx); });
      const keepRange = () => { const s = window.getSelection(); if (s.rangeCount && bd.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange(); };
      bd.addEventListener('keyup', keepRange); bd.addEventListener('pointerup', keepRange); bd.addEventListener('input', keepRange);
      bd.addEventListener('click', e => { const c = e.target.closest('cite[data-doc]'); if (c) { e.preventDefault(); ctx.jumpTo(c.dataset.doc, +c.dataset.p || 1); } });
      bd.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('cite[data-doc]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctx.jumpTo(c.dataset.doc, +c.dataset.p || 1); } if (e.key === '/') e.stopPropagation(); });
      links.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (!b) return; const i = b.dataset.open.indexOf(':'); ctx.open(b.dataset.open.slice(0, i), b.dataset.open.slice(i + 1), { beside: true }); });
      const tb = root.querySelector('.nv-bar');
      tb.addEventListener('mousedown', e => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });
      tb.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'hist') { history(); return; }
        if (b.dataset.a === 'more') { menu(b, [
          { l: t('Tags, links and pinning…', 'Emneknagger, koblinger og festing …'), f: () => A.go('notes/' + id) },
          { l: t('Copy as text', 'Kopier som tekst'), f: () => { try { navigator.clipboard.writeText((n.title ? n.title + '\n\n' : '') + W.noteText(n)); A.toast(t('Copied.', 'Kopiert.')); } catch (er) {} } },
          { sep: 1 }, { l: t('Move to trash', 'Flytt til papirkurv'), f: () => A.doTrash(id), danger: 1 }]); return; }
        const cmd = b.dataset.cmd; if (!cmd) return;
        if (cmd === 'cite') { const f = citeSource(ctx.paneId); if (f) { insertCite(D.citeHtml(f.docId, f.p, f.label, A.item(f.docId).name)); } return; }
        bd.focus(); if (lastRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(lastRange); }
        if (cmd === 'mark') { const s = window.getSelection(); if (s.rangeCount && !s.isCollapsed && bd.contains(s.anchorNode)) { const r = s.getRangeAt(0), inMark = (s.anchorNode.parentElement || bd).closest('mark'); try { if (inMark && bd.contains(inMark)) inMark.replaceWith(...inMark.childNodes); else r.surroundContents(document.createElement('mark')); } catch (er) { A.toast(t('Highlight one paragraph at a time.', 'Uthev ett avsnitt om gangen.')); } } }
        else if (cmd === 'formatBlock') { const blk = (window.getSelection().anchorNode || bd); const inH = blk.nodeType === 1 ? blk.closest('h3') : blk.parentElement && blk.parentElement.closest('h3'); document.execCommand('formatBlock', false, inH ? 'div' : 'h3'); }
        else document.execCommand(cmd, false, b.dataset.arg || null);
        save({ body: bd.innerHTML });
      });
      function insertCite(html) {
        const tpl = document.createElement('template'); tpl.innerHTML = html;
        const node = tpl.content.firstChild, sp = document.createTextNode(' ');
        const r = lastRange && bd.contains(lastRange.startContainer) ? lastRange : null;
        if (r) { r.deleteContents(); r.insertNode(sp); r.insertNode(node); }
        else { const div = document.createElement('div'); div.append(node, sp); const last = bd.lastElementChild; if (last && !last.textContent.trim() && !last.querySelector('cite')) last.replaceWith(div); else bd.appendChild(div); }
        const s = window.getSelection(), nr = document.createRange(); nr.setStartAfter(sp); nr.collapse(true); lastRange = nr.cloneRange();
        lock(); save({ body: bd.innerHTML });
        if (bd.ownerDocument.activeElement === bd) { s.removeAllRanges(); s.addRange(nr); }
        node.classList.add('new'); setTimeout(() => node.classList.remove('new'), 1400);
        if (node.getBoundingClientRect().bottom > sc.getBoundingClientRect().bottom) node.scrollIntoView({ block: 'nearest' });
      }
      function history() {
        const vs = (n.versions || []).slice().reverse();
        A.openDlg(`<h3 id="wsDlgH">${esc(t('Version history', 'Versjonshistorikk'))}</h3>${vs.length ? `<p>${esc(t('Restoring keeps the current text as a new version, so you can always go back.', 'Når du gjenoppretter, tas den nåværende teksten vare på som en ny versjon, så du kan alltid gå tilbake.'))}</p><ul class="vers">${vs.map(v => `<li><span><span class="w">${esc(A.dayClock(v.at))}</span><span class="sn">${esc((v.title ? v.title + ' – ' : '') + W.htmlToText(v.body).replace(/\s+/g, ' ').slice(0, 80)) || esc(t('Empty', 'Tom'))}</span><small>${v.conflict ? `<span class="cf">${esc(t('From another device', 'Fra en annen enhet'))}</span> · ` : ''}${A.plural(W.wordCount(v), 'word', 'words', 'ord', 'ord')}</small></span><button type="button" class="lk" data-ver="${v.at}">${esc(t('Restore', 'Gjenopprett'))}</button></li>`).join('')}</ul>` : `<p>${esc(t('Earlier versions appear here as you keep writing. The last 20 are kept.', 'Tidligere versjoner dukker opp her etter hvert som du skriver. De siste 20 tas vare på.'))}</p>`}<div class="foot"><button type="button" class="btn" data-close>${esc(t('Close', 'Lukk'))}</button></div>`,
          close => { document.querySelectorAll('#wsDlg [data-ver]').forEach(b => { b.onclick = () => close(+b.dataset.ver); }); })
          .then(at => { if (!at) return; n = W.restoreVersion(A.item(id), at); A.commit(n); bd.innerHTML = n.body; ttl.value = n.title; lock(); drawTabTitles(); A.toast(t('Version restored.', 'Versjonen er gjenopprettet.')); });
      }
      if (!n.title && !n.body) setTimeout(() => { if (alive) ttl.focus(); }, 30);
      const v = {
        insertCite, focusEnd() { bd.focus(); const r = document.createRange(); r.selectNodeContents(bd); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange(); },
        ctxChanged() { const btn = tb.querySelector('.nv-cite'); if (btn) btn.hidden = !citeSource(ctx.paneId); },
        refresh() {
          const cur = A.item(id); if (!W.isLive(cur)) return 'remount';
          const a = document.activeElement, typing = a && root.contains(a);
          if (!typing && cur.updatedAt !== n.updatedAt) { n = cur; if (bd.innerHTML !== n.body) { bd.innerHTML = n.body; lock(); } if (ttl.value !== n.title) ttl.value = n.title; drawLinks(); stat(false); }
        },
        destroy() { alive = false; }
      };
      return v;
    }
    /* the page shown in a document beside this note: { docId, p, label } */
    function citeSource(notePane) {
      for (const p of (phoneMode ? [] : D.panes(L))) { if (p.id === notePane) continue; const tb = p.tabs.find(x => x.id === p.a); if (tb && tb.k === 'doc' && W.isLive(A.item(tb.r))) { const v = views.get(tb.id); const s = v && v.pos && v.pos(); if (s && s.paged) return { docId: tb.r, p: s.p, label: pdfLabel(tb.r, s.p) }; } }
      return null;
    }
    function pdfLabel(docId, p) { const e = pdfCache.get(docId); return (e && e.labels && e.labels[p - 1]) || String(p); }
    function drawTabTitles() { panesEl.forEach(pe => pe.strip.querySelectorAll('.dk-tab').forEach(x => { const tb = D.tabById(L, x.dataset.tab); if (tb) { const nm = typeOf(tb.k).title(tb.r); x.querySelector('.tl').textContent = nm; x.title = nm; } })); }

    /* ---------- aircraft card ---------- */
    function mountAircraft(box, tab, ctx) {
      const id = tab.r; let a = A.item(id);
      if (!W.isLive(a)) return missing(box, 'aircraft', id, ctx);
      const root = h('div', 'av'); box.appendChild(root);
      function draw() {
        a = A.item(id); const ty = W.typeOf(a.typeKey), docs = A.docsAll().filter(d => (d.acIds || []).includes(id)), notes = A.notesAll().filter(n => (n.links || []).some(l => l.t === 'aircraft' && l.id === id)), packs = A.packsAll().filter(p => A.packAc(p) === a);
        const row = (k, r, n, s, i) => `<li><button type="button" data-open="${k}:${esc(r)}">${ic(i || k)}<span class="n">${esc(n)}</span>${s ? `<small>${esc(s)}</small>` : ''}</button></li>`;
        root.innerHTML = `<div class="av-sc" data-keep-scroll><div class="av-in">
          <header class="av-h"><div><div class="reg">${esc(a.reg || a.type || A.acName(a))}</div><div class="ty">${esc([a.reg ? a.type : '', a.callsign ? t('Callsign ', 'Kallesignal ') + a.callsign : ''].filter(Boolean).join(' · '))}</div></div>
            <div class="acts">${ty.trainer ? `<a class="btn sm pri" href="${ty.trainer}">${esc(t('Launch simulator', 'Start simulatoren'))}</a>` : ''}<button type="button" class="btn sm" data-av="note">${esc(t('New note', 'Nytt notat'))}</button><button type="button" class="btn sm" data-av="pack">${esc(t('New briefing pack', 'Ny briefingpakke'))}</button><button type="button" class="dk-ib" data-av="more" aria-haspopup="menu" aria-label="${esc(t('More', 'Mer'))}">${ic('more')}</button></div></header>
          <div class="av-grid"><section><h3>${esc(t('Key speeds and limits', 'Viktige hastigheter og grenser'))} <span class="savedmark" data-sv></span></h3>
            <table class="speeds"><colgroup><col class="ck"><col class="cv"><col class="cu"><col class="cx"></colgroup><thead><tr><th>${esc(t('Item', 'Punkt'))}</th><th style="text-align:right">${esc(t('Value', 'Verdi'))}</th><th>${esc(t('Unit', 'Enhet'))}</th><th><span hidden>x</span></th></tr></thead><tbody>${(a.speeds || []).map(A.speedRow).join('')}</tbody></table>
            <p class="speeds-note"><button type="button" class="lk" data-av="sp-add">${esc(t('Add a row', 'Legg til en rad'))}</button> · ${esc(t('From this aircraft’s own AFM or POH. Birdbird does not fill them in.', 'Fra flyets egen AFM eller POH. Birdbird fyller dem ikke ut.'))}</p>
            <h3><label for="avN${esc(tab.id)}">${esc(t('About this aircraft', 'Om dette flyet'))}</label></h3><textarea class="acnotes" id="avN${esc(tab.id)}" maxlength="4000" placeholder="${esc(t('Equipment, quirks, where the tow bar is kept…', 'Utstyr, særheter, hvor slepestangen ligger …'))}">${esc(a.notes)}</textarea></section>
          <section><h3>${esc(t('Documents', 'Dokumenter'))} <span class="c">${docs.length}</span></h3>${docs.length ? `<ul class="av-l">${docs.map(d => row('doc', d.id, d.name, A.catName(d.cat), docKind(d))).join('')}</ul>` : `<p class="none">${esc(t('Link documents to this aircraft in the Library.', 'Koble dokumenter til dette flyet i biblioteket.'))}</p>`}
            <h3>${esc(t('Notes', 'Notater'))} <span class="c">${notes.length}</span></h3>${notes.length ? `<ul class="av-l">${notes.map(n => row('note', n.id, A.noteTitle(n), A.ago(n.updatedAt))).join('')}</ul>` : `<p class="none">${esc(t('Notes linked to this aircraft show here.', 'Notater koblet til dette flyet vises her.'))}</p>`}
            <h3>${esc(t('Briefing packs', 'Briefingpakker'))} <span class="c">${packs.length}</span></h3>${packs.length ? `<ul class="av-l">${packs.map(p => row('pack', p.id, A.packTitle(p), (p.f || {}).date || '')).join('')}</ul>` : `<p class="none">${esc(t('Briefing packs with this registration show here.', 'Briefingpakker med denne registreringen vises her.'))}</p>`}</section></div></div></div>`;
        const tbody = root.querySelector('tbody');
        const saveSp = () => { const rows = [...tbody.querySelectorAll('tr')].map(tr => ({ k: tr.querySelector('.k').value.slice(0, 24), v: tr.querySelector('.v').value.slice(0, 16), u: tr.querySelector('.u').value.slice(0, 10) })); A.commit(W.patch(A.item(id), { speeds: rows })); root.querySelector('[data-sv]').textContent = t('Saved', 'Lagret'); };
        tbody.addEventListener('input', saveSp);
        tbody.addEventListener('click', e => { const b = e.target.closest('[data-act="sp-del"]'); if (b) { e.stopPropagation(); b.closest('tr').remove(); saveSp(); } });
        root.querySelector('textarea').addEventListener('input', e => { A.commit(W.patch(A.item(id), { notes: e.target.value })); });
      }
      draw();
      root.addEventListener('click', e => {
        const o = e.target.closest('[data-open]'); if (o) { const i = o.dataset.open.indexOf(':'); ctx.open(o.dataset.open.slice(0, i), o.dataset.open.slice(i + 1), { beside: true }); return; }
        const b = e.target.closest('[data-av]'); if (!b) return; const k = b.dataset.av;
        if (k === 'note') newNote({ title: (a.reg || a.type || '') + ' – ', links: [{ t: 'aircraft', id }] }, { pane: ctx.paneId, beside: true });
        else if (k === 'pack') A.newPack(id);
        else if (k === 'sp-add') { const tbody = root.querySelector('tbody'); tbody.insertAdjacentHTML('beforeend', A.speedRow({ k: '', v: '', u: 'KIAS' })); tbody.lastElementChild.querySelector('.k').focus(); }
        else if (k === 'more') menu(b, [{ l: t('Edit type and registration…', 'Endre type og registrering …'), f: () => A.aircraftDlg(A.item(id)).then(r => { if (r) draw(); drawTabTitles(); }) }, { l: t('Open the full aircraft page', 'Åpne hele flysiden'), f: () => A.go('aircraft/' + id) }, { sep: 1 }, { l: t('Move to trash', 'Flytt til papirkurv'), f: () => A.doTrash(id), danger: 1 }]);
      });
      let seen = a.updatedAt;
      const v = { refresh() { const cur = A.item(id); if (!W.isLive(cur)) return 'remount'; const ae = document.activeElement; if (cur.updatedAt !== seen && !(ae && root.contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName))) { seen = cur.updatedAt; const y = root.firstElementChild.scrollTop; draw(); root.firstElementChild.scrollTop = y; } }, destroy() {} };
      if (phoneMode) swipeable(root, () => true, ctx);
      return v;
    }

    /* ---------- briefing pack, route, notebook ---------- */
    function card(box, ctx, html) { const r = h('div', 'cv'); r.innerHTML = `<div class="cv-sc" data-keep-scroll><div class="cv-in">${html}</div></div>`; box.appendChild(r); if (phoneMode) swipeable(r, () => true, ctx); return r; }
    function mountPack(box, tab, ctx) {
      const p = findPack(tab.r); if (!p) return missing(box, 'pack', tab.r, ctx);
      const f = p.f || {}, a = A.packAc(p), FL = window.FLIGHT;
      const F = [[t('Alternate', 'Alternativ'), f.alt1apt || f.altn], [t('Rules', 'Regler'), f.rules], ['ETD', f.etd], [t('Route', 'Rute'), f.route]].filter(x => x[1]);
      const rt = FL ? FL.routeForPack(S.routes, p) : null, sim = FL ? FL.simFor(f.type, a && a.typeKey) : null, H = FL ? FL.header(p) : {};
      const fh = FL ? `<div class="cv-fl"><p class="cv-fl-r"><b class="mono">${esc(H.dep || '—')}</b><span aria-hidden="true">→</span><b class="mono">${esc(H.dest || '—')}</b></p>
          <p class="cv-fl-m">${[H.date ? `<span class="mono">${esc(H.date)}</span>` : '', H.ac ? `<span>${esc(H.ac)}</span>` : ''].filter(Boolean).join('<i aria-hidden="true">·</i>') || esc(t('No date or aircraft yet', 'Ingen dato eller fly ennå'))}</p>
          <div class="cv-fl-b">${rt ? `<button type="button" class="btn sm" data-open="route:${esc(rt.id)}">${esc(t('Route', 'Rute'))}</button>` : `<a class="btn sm" href="route.html?pack=${encodeURIComponent(p.id)}">${esc(t('Route', 'Rute'))}</a>`}<a class="btn sm" href="prep.html?id=${encodeURIComponent(p.id)}">${esc(t('Briefing', 'Briefing'))}</a><a class="btn sm" data-sim="${esc(sim.k)}" href="${esc(sim.href)}" title="${esc(t(sim.en, sim.no))}">${esc(t('Fly the approach', 'Fly innflygingen'))}</a></div>
          <p class="cv-fl-n">${esc(t(sim.en, sim.no))}</p></div>` : '';
      const r = card(box, ctx, `<p class="eb">${esc(t('Briefing pack', 'Briefingpakke'))}</p><h2>${esc(A.packTitle(p))}</h2>${fh}
        <dl class="cv-f">${F.map(x => `<div><dt>${esc(x[0])}</dt><dd class="${/Route|Rute|ETD/.test(x[0]) ? 'mono' : ''}">${esc(x[1])}</dd></div>`).join('') || `<div><dt>${esc(t('Saved', 'Lagret'))}</dt><dd>${esc(A.ago(p.updated || p.created))}</dd></div>`}</dl>
        <div class="row"><a class="btn pri" href="prep.html?id=${encodeURIComponent(p.id)}">${esc(t('Open the briefing pack', 'Åpne briefingpakken'))}</a>${a ? `<button type="button" class="btn" data-open="aircraft:${esc(a.id)}">${esc(a.reg || A.acName(a))}</button>` : ''}</div>
        <p class="note">${esc(t('The briefing pack opens in the planner, with weather, NOTAM, fuel and mass and balance.', 'Briefingpakken åpnes i planleggeren, med vær, NOTAM, drivstoff og masse og balanse.'))}</p>`);
      r.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (!o) return; const v = o.dataset.open, i = v.indexOf(':'); ctx.open(v.slice(0, i), v.slice(i + 1), { beside: true }); });
      return {};
    }
    function mountRoute(box, tab, ctx) {
      const x = findRoute(tab.r); if (!x) return missing(box, 'route', tab.r, ctx);
      const pts = (x.pts || []).map(p => p.n).filter(Boolean), pk = window.FLIGHT ? window.FLIGHT.packForRoute(S.packs, x) : null;
      const r = card(box, ctx, `<p class="eb">${esc(t('Route', 'Rute'))}</p><h2>${esc(A.routeTitle(x))}</h2>
        <dl class="cv-f"><div><dt>${esc(t('Points', 'Punkter'))}</dt><dd class="mono">${(x.pts || []).length}</dd></div>${x.s && x.s.cr ? `<div><dt>${esc(t('Cruise', 'Marsjhøyde'))}</dt><dd class="mono">${esc(x.s.cr)} ft</dd></div>` : ''}<div><dt>${esc(t('Saved', 'Lagret'))}</dt><dd>${esc(A.ago(x.updated))}</dd></div></dl>
        ${pts.length ? `<p class="cv-pts mono">${pts.map(esc).join(' <span>›</span> ')}</p>` : ''}
        <div class="row"><a class="btn pri" href="route.html?id=${encodeURIComponent(x.id)}">${esc(t('Open in Route Explorer', 'Åpne i Route Explorer'))}</a>${pk ? `<button type="button" class="btn" data-open="pack:${esc(pk.id)}">${esc(t('Briefing pack', 'Briefingpakke'))}: ${esc(A.packTitle(pk))}</button>` : ''}</div>`);
      r.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) ctx.open('pack', o.dataset.open.slice(5), { beside: true }); });
      return {};
    }
    function mountNotebook(box, tab, ctx) { if (!window.WSNB) return missing(box, 'notebook', tab.r, ctx); return window.WSNB.mountNotebook(box, tab, ctx); }
    function mountAsk(box, tab, ctx) { if (!window.WSASK) return mountUnknown(box, tab, ctx); return window.WSASK.mountAsk(box, tab, ctx); }
    function mountUnknown(box, tab, ctx) { return missing(box, tab.k, tab.r, ctx); }

    /* ---------- quick open (Ctrl/Cmd K) ---------- */
    function palette(o) {
      o = o || {}; const target = o.pane || L.act;
      const cmds = () => [
        { c: 'note', n: t('New note', 'Nytt notat'), i: 'note' }, { c: 'nb', n: t('New notebook', 'Ny notatbok'), i: 'pen' }, { c: 'ask', n: t('Ask your documents', 'Spør dokumentene'), i: 'ask' }, { c: 'add', n: t('Add documents…', 'Legg til dokumenter …'), i: 'plus' },
        !isPhone() && D.panes(L).length < maxPanes() ? { c: 'split-h', n: t('Split right', 'Del til høyre'), i: 'splith' } : null,
        canDown() && D.panes(L).length < maxPanes() ? { c: 'split-v', n: t('Split down', 'Del nedover'), i: 'splitv' } : null,
        { c: 'desk', n: t('New desk…', 'Ny arbeidsflate …'), i: 'tabs' }, { c: 'map', n: t('Map of your workspace', 'Kart over arbeidsområdet'), i: 'map' }, { c: 'lib', n: t('Library and backup', 'Bibliotek og sikkerhetskopi'), i: 'lib' }].filter(Boolean);
      const name = { aircraft: t('Aircraft', 'Fly'), doc: t('Document', 'Dokument'), note: t('Note', 'Notat'), pack: t('Briefing pack', 'Briefingpakke'), route: t('Route', 'Rute'), notebook: t('Notebook', 'Notatbok') };
      let rows = [], sel = 0;
      function compute(q) {
        q = q.trim(); const out = [];
        if (!q) {
          if (o.only) { (o.only === 'doc' ? A.docsAll().map(d => ({ k: 'doc', r: d.id, n: d.name, s: A.catName(d.cat), i: docKind(d) })) : A.aircraft().map(a => ({ k: 'aircraft', r: a.id, n: a.reg || A.acName(a), s: a.reg ? a.type : '' }))).forEach(x => out.push(x)); }
          else { (A.M.recent || []).filter(r => TYPES[r.t] && live(r.t, r.id)).slice(0, 8).forEach(r => out.push({ k: r.t, r: r.id, n: TYPES[r.t].title(r.id), s: t('Recent', 'Nylig'), i: TYPES[r.t].icon(r.id) })); cmds().forEach(c => out.push(c)); }
          return out;
        }
        A.findAll(q).filter(x => !o.only || x.entry.t === o.only).slice(0, 14).forEach(x => out.push({ k: x.entry.t, r: x.entry.id, n: x.entry.title, s: name[x.entry.t] + (x.snippet ? ' · ' + x.snippet.slice(0, 70) : ''), i: x.entry.t === 'doc' ? docKind(A.item(x.entry.id)) : x.entry.t }));
        if (!o.only || o.only === 'doc') A.docsAll().map(d => { const sd = S.docs[d.id]; const f = sd ? W.searchChunks(sd.chunks, q) : null; return f ? { d, f } : null; }).filter(Boolean).sort((a, b) => b.f.hits - a.f.hits).slice(0, 6)
          .forEach(x => out.push({ k: 'doc', r: x.d.id, p: x.f.p, n: x.d.name + ' · ' + t('p. ', 's. ') + x.f.p, s: x.f.snippet.slice(0, 90), i: docKind(x.d) }));
        if (!o.only) { const tk = W.tokens(q); cmds().filter(c => tk.every(x => W.fold(c.n).includes(x))).forEach(c => out.push(c)); }
        return out;
      }
      function draw() {
        const ul = document.querySelector('#wsDlg .pal-l'); if (!ul) return;
        ul.innerHTML = rows.length ? rows.map((r, i) => `<li role="option" id="palo${i}" aria-selected="${i === sel}" class="${i === sel ? 'on' : ''}" data-i="${i}">${ic(r.i || r.k)}<span class="n">${esc(r.n)}</span>${r.s ? `<small>${esc(r.s)}</small>` : ''}${r.c ? '' : `<span class="k">${esc(t('Open', 'Åpne'))}</span>`}</li>`).join('') : `<li class="none">${esc(t('Nothing found. Try fewer or shorter words.', 'Ingen treff. Prøv færre eller kortere ord.'))}</li>`;
        const inp = document.querySelector('#wsDlg .pal-q'); if (inp) inp.setAttribute('aria-activedescendant', rows.length ? 'palo' + sel : '');
        const on = ul.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
      }
      const ttl = o.only === 'doc' ? t('Open a document', 'Åpne et dokument') : o.only === 'aircraft' ? t('Choose an aircraft', 'Velg et fly') : t('Open anything', 'Åpne hva som helst');
      A.openDlg(`<div class="pal"><h3 id="wsDlgH" class="sr">${esc(ttl)}</h3><div class="pal-in">${ic('search')}<input class="pal-q" type="search" role="combobox" aria-expanded="true" aria-controls="palL" aria-label="${esc(ttl)}" placeholder="${esc(ttl + ' …')}" autocomplete="off" spellcheck="false" autofocus></div>
        <ul class="pal-l" id="palL" role="listbox"></ul><p class="pal-f"><span><kbd>↵</kbd> ${esc(t('open here', 'åpne her'))}</span>${isPhone() ? '' : `<span><kbd>⇧↵</kbd> ${esc(t('open beside', 'åpne ved siden av'))}</span>`}<span><kbd>esc</kbd> ${esc(t('close', 'lukk'))}</span></p></div>`, close => {
        const dlg = document.getElementById('wsDlg'); dlg.classList.add('pal-dlg');
        const inp = dlg.querySelector('.pal-q'), ul = dlg.querySelector('.pal-l');
        rows = compute(''); draw();
        inp.addEventListener('input', () => { rows = compute(inp.value); sel = 0; draw(); });
        inp.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); draw(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
          else if (e.key === 'Enter') { e.preventDefault(); if (rows[sel]) close({ r: rows[sel], beside: e.shiftKey || e.altKey }); }
        });
        ul.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) close({ r: rows[+li.dataset.i], beside: e.shiftKey || e.altKey }); });
      }).then(res => {
        const dlg = document.getElementById('wsDlg'); dlg.classList.remove('pal-dlg');
        if (!res || !res.r) return; const r = res.r;
        if (r.c) { runCmd(r.c, target); return; }
        openItem(r.k, r.r, { pane: target, beside: res.beside, st: r.p ? { p: r.p, o: 0 } : undefined, flash: !!r.p });
      });
    }
    function runCmd(c, paneId) {
      if (c === 'note') newNote({}, { pane: paneId }); else if (c === 'nb') newNotebook({ pane: paneId }); else if (c === 'ask') askBeside(null, paneId); else if (c === 'add') A.pickFiles({}); else if (c === 'split-h') splitPane(paneId, 'h'); else if (c === 'split-v') splitPane(paneId, 'v');
      else if (c === 'desk') deskNew(); else if (c === 'lib') A.go('library'); else if (c === 'map') A.go('map');
    }

    /* ---------- desks ---------- */
    function nameDlg(title, val, ok) {
      return A.openDlg(`<h3 id="wsDlgH">${esc(title)}</h3><form id="dkNameF" novalidate><div class="fld"><label for="dkName">${esc(t('Name', 'Navn'))}</label><input id="dkName" maxlength="60" value="${esc(val || '')}" placeholder="${esc(t('e.g. B200 type rating, Next flight', 'f.eks. B200 typerating, Neste tur'))}" autofocus></div><div class="foot"><button type="button" class="btn" data-close>${esc(t('Cancel', 'Avbryt'))}</button><button type="submit" class="btn pri">${esc(ok)}</button></div></form>`,
        close => { document.getElementById('dkNameF').onsubmit = e => { e.preventDefault(); const v = D.cleanName(document.getElementById('dkName').value); if (v) close(v); }; const i = document.getElementById('dkName'); setTimeout(() => i.select(), 10); });
    }
    function switchDesk(id) {
      if (desk && id === desk.id) return; snapshot();
      const d = desks().find(x => x.id === id); if (!d) return;
      loadDesk(d); render(true); drawBar(); drawRail();
    }
    async function deskNew() {
      if (desks().length >= D.MAX_DESKS) { A.toast(t('You have the most desks there is room for. Delete one first.', 'Du har så mange arbeidsflater det er plass til. Slett en først.')); return; }
      const nm = await nameDlg(t('New desk', 'Ny arbeidsflate'), '', t('Create desk', 'Lag arbeidsflate')); if (!nm) return;
      snapshot(); if (desk.unsaved && D.allTabs(L).length) { desk.unsaved = false; const it = D.newDesk({ id: desk.id, name: desk.name, L }); A.commit(it); }
      const d = D.newDesk({ name: nm }); await A.commit(d); loadDesk(d); render(true); drawBar(); drawRail();
    }
    async function deskRename() { const nm = await nameDlg(t('Rename desk', 'Gi arbeidsflaten nytt navn'), desk.name, t('Save', 'Lagre')); if (!nm) return; desk.name = nm; desk.unsaved = false; const cur = A.item(desk.id); await A.commit(cur && !cur.gone ? W.patch(cur, { name: nm, L: D.sanitize(L) }) : D.newDesk({ id: desk.id, name: nm, L })); drawBar(); updatePanes(); }
    async function deskDup() {
      if (desks().length >= D.MAX_DESKS) return; collectStates();
      const d = D.dupDesk({ name: desk.name, L }, desk.name + ' ' + t('(copy)', '(kopi)')); snapshot(); await A.commit(d); loadDesk(d); render(true); drawBar(); drawRail();
      A.toast(t('Desk duplicated.', 'Arbeidsflaten er duplisert.'));
    }
    async function deskDelete() {
      const cur = A.item(desk.id), name = desk.name;
      if (!cur || cur.gone) { loadDesk({ id: desk.id, name: desk.name, L: D.newLayout(), unsaved: true }); render(true); return; }
      if (!await A.confirmDlg({ title: t('Delete this desk?', 'Slette denne arbeidsflaten?'), text: t('“' + name + '” goes to the trash for 30 days. Only the layout is deleted: the documents and notes on it stay in your library.', '«' + name + '» legges i papirkurven i 30 dager. Bare oppsettet slettes: dokumentene og notatene på den blir værende i biblioteket.'), ok: t('Move to trash', 'Flytt til papirkurv'), danger: true })) return;
      collectStates(); await A.commit(W.trash(W.patch(cur, { L: D.sanitize(L) })));
      try { A.LS && A.LS.removeItem(SNAP); } catch (e) {}
      const next = desks()[0];
      loadDesk(next || { id: 'dk' + Date.now().toString(36), name: t('My desk', 'Min arbeidsflate'), L: D.newLayout(), unsaved: true });
      render(true); drawBar(); drawRail();
      A.toast(t('Desk moved to the trash: ', 'Arbeidsflaten er flyttet til papirkurven: ') + name, [t('Undo', 'Angre'), async () => { await A.commit(W.restore(A.item(cur.id))); switchDesk(cur.id); }]);
    }
    function deskMenu(btn) {
      const list = desks(); if (!list.some(x => x.id === desk.id)) list.unshift({ id: desk.id, name: desk.name });
      menu(btn, list.map(d => ({ l: d.name, f: () => switchDesk(d.id), on: d.id === desk.id })).concat([{ sep: 1 },
        { l: t('New desk…', 'Ny arbeidsflate …'), f: deskNew }, { l: t('Rename…', 'Gi nytt navn …'), f: deskRename }, { l: t('Duplicate', 'Dupliser'), f: deskDup }, { sep: 1 }, { l: t('Delete desk…', 'Slett arbeidsflaten …'), f: deskDelete, danger: 1 }]), true);
    }

    /* ---------- menus ---------- */
    let menuEl = null, menuBack = null;
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('pointerdown', outside, true); if (menuBack && menuBack.isConnected) menuBack.focus({ preventScroll: true }); menuBack = null; } }
    const outside = e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); };
    /* at: an element (opens below it) or { x, y } */
    function menu(at, items, radio) {
      closeMenu(); items = items.filter(x => x && !x.hide);
      menuEl = h('div', 'dk-menu'); menuEl.setAttribute('role', 'menu');
      menuEl.innerHTML = items.map((x, i) => x.sep ? '<div class="sep" role="separator"></div>' : `<button type="button" role="${radio ? 'menuitemradio' : 'menuitem'}"${radio && x.f ? ` aria-checked="${!!x.on}"` : ''} data-i="${i}" class="${x.danger ? 'danger' : ''}${x.on ? ' on' : ''}"${x.dis ? ' disabled' : ''}>${esc(x.l)}</button>`).join('');
      document.body.appendChild(menuEl);
      const r = at.getBoundingClientRect ? at.getBoundingClientRect() : { left: at.x, right: at.x, bottom: at.y, top: at.y }, mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
      let x = at.getBoundingClientRect ? (r.left + mw > window.innerWidth - 8 ? r.right - mw : r.left) : at.x, y = r.bottom + 4;
      if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 4);
      menuEl.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, x)) + 'px'; menuEl.style.top = y + 'px';
      menuBack = at.focus ? at : null;
      menuEl.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; closeMenu(); if (it && it.f) it.f(); });
      menuEl.addEventListener('keydown', e => {
        const bs = [...menuEl.querySelectorAll('button:not([disabled])')], i = bs.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
      });
      setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
      const first = menuEl.querySelector('button.on') || menuEl.querySelector('button:not([disabled])'); if (first) first.focus({ preventScroll: true });
    }
    function tabMenu(at, tabId) {
      const tb = D.tabById(L, tabId); if (!tb) return; const p = D.paneOfTab(L, tabId), full = D.panes(L).length >= maxPanes();
      menu(at, [
        { l: tb.pin ? t('Unpin tab', 'Løsne fanen') : t('Pin tab', 'Fest fanen'), f: () => changed(D.pin(L, tabId, !tb.pin), 'shape') },
        { l: t('Move to a new pane on the right', 'Flytt til et nytt panel til høyre'), f: () => { const r = D.moveToNew(L, tabId, 'h', null, maxPanes()); if (r) changed(r.L, 'shape'); }, hide: isPhone() || full || p.tabs.length < 2 },
        { l: t('Move to a new pane below', 'Flytt til et nytt panel under'), f: () => { const r = D.moveToNew(L, tabId, 'v', null, maxPanes()); if (r) changed(r.L, 'shape'); }, hide: !canDown() || full || p.tabs.length < 2 },
        { l: t('Move to the next pane', 'Flytt til neste panel'), f: () => { const n = D.nextPane(L, p.id); if (n) changed(D.move(L, tabId, n.id), 'shape'); }, hide: isPhone() || D.panes(L).length < 2 },
        { sep: 1 },
        { l: t('Close', 'Lukk'), f: () => changed(D.close(L, tabId, true), 'shape') },
        { l: t('Close other tabs', 'Lukk andre faner'), f: () => changed(D.closeOthers(L, tabId), 'shape'), hide: p.tabs.length < 2 }]);
    }
    function paneMenu(at, paneId) {
      const p = D.paneById(L, paneId) || D.activePane(L), full = D.panes(L).length >= maxPanes();
      menu(at, [
        { l: t('Open…', 'Åpne …'), f: () => palette({ pane: p.id }) },
        { l: t('New note here', 'Nytt notat her'), f: () => newNote({}, { pane: p.id }) },
        { sep: 1, hide: isPhone() },
        { l: t('Split right', 'Del til høyre'), f: () => splitPane(p.id, 'h'), hide: isPhone(), dis: full },
        { l: t('Split down', 'Del nedover'), f: () => splitPane(p.id, 'v'), hide: !canDown(), dis: full },
        { l: t('Close unpinned tabs', 'Lukk faner som ikke er festet'), f: () => { let nl = L; p.tabs.filter(x => !x.pin).forEach(x => { nl = D.close(nl, x.id); }); changed(nl, 'shape'); }, hide: !p.tabs.some(x => !x.pin) },
        { l: t('Close this pane', 'Lukk dette panelet'), f: () => changed(D.removePane(L, p.id), 'shape'), hide: isPhone() || D.panes(L).length < 2 }]);
    }
    function switcher(at) {
      const tabs = D.allTabs(L), cur = D.activeTab(L);
      menu(at, tabs.map(x => ({ l: typeOf(x.k).title(x.r), f: () => activateTab(x.id), on: cur && cur.id === x.id })), true);
    }

    /* ---------- drag: tabs between panes, library items onto the desk ---------- */
    let drag = null;
    const blockTouch = e => { if (drag && drag.on) e.preventDefault(); };
    function dragStart(e, payload, label) {
      if (e.button > 0 || isPhone() && payload.tab) return;
      drag = { payload, label, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, touch: e.pointerType === 'touch', lp: 0, tgt: null };
      if (drag.touch) drag.lp = setTimeout(() => { if (drag && !drag.on) begin(); }, 320);
      window.addEventListener('pointermove', dragMove, { passive: true });
      window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragCancel);
    }
    function begin() {
      drag.on = true; document.addEventListener('touchmove', blockTouch, { passive: false });
      drag.ghost = h('div', 'dk-ghost'); drag.ghost.textContent = drag.label; document.body.appendChild(drag.ghost);
      drag.ind = h('div', 'dk-drop'); document.body.appendChild(drag.ind);
      document.documentElement.classList.add('dk-dragging');
      place(drag.x, drag.y);
    }
    function dragMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on) { const d2 = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); if (drag.touch) { if (d2 > 10) dragCancel(); return; } if (d2 < 6) return; begin(); }
      place(e.clientX, e.clientY);
    }
    function place(x, y) {
      drag.ghost.style.transform = `translate(${Math.round(x + 12)}px,${Math.round(y + 10)}px)`;
      drag.tgt = target(x, y); const ind = drag.ind, g = drag.tgt;
      if (!g) { ind.style.display = 'none'; return; }
      ind.style.display = 'block'; ind.className = 'dk-drop ' + g.kind;
      const r = g.rect; ind.style.left = r.left + 'px'; ind.style.top = r.top + 'px'; ind.style.width = r.width + 'px'; ind.style.height = r.height + 'px';
    }
    function target(x, y) {
      const elx = document.elementFromPoint(x, y); if (!elx) return null;
      const paneE = elx.closest('.dk-pane'); if (!paneE || !mainEl.contains(paneE)) return null;
      const paneId = paneE.dataset.pane; if (paneId === 'phone') return null;
      const p = D.paneById(L, paneId); if (!p) return null;
      const full = D.panes(L).length >= maxPanes(), fromPane = drag.payload.tab ? D.paneOfTab(L, drag.payload.tab) : null;
      const tabE = elx.closest('.dk-tab'), stripE = elx.closest('.dk-strip');
      if (stripE) {
        const tabs = [...stripE.querySelectorAll('.dk-tab')]; let idx = tabs.length, rr;
        if (tabE) { const b = tabE.getBoundingClientRect(); idx = tabs.indexOf(tabE) + (x > b.left + b.width / 2 ? 1 : 0); }
        const ref = tabs[idx] || tabs[tabs.length - 1];
        if (ref) { const b = ref.getBoundingClientRect(); rr = { left: (tabs[idx] ? b.left : b.right) - 1, top: b.top + 4, width: 3, height: b.height - 8 }; } else { const b = stripE.getBoundingClientRect(); rr = { left: b.left + 6, top: b.top + 4, width: 3, height: b.height - 8 }; }
        return { kind: 'line', paneId, index: idx, rect: rr };
      }
      const b = paneE.getBoundingClientRect(), body = paneE.querySelector('.dk-pb').getBoundingClientRect();
      const lonely = fromPane && fromPane.id === paneId && fromPane.tabs.length < 2;
      if (!full && !lonely && x > b.right - b.width * 0.28) return { kind: 'zone', paneId, split: 'h', rect: { left: b.left + b.width / 2, top: body.top, width: b.width / 2, height: body.height } };
      if (!full && !lonely && canDown() && y > b.bottom - b.height * 0.28) return { kind: 'zone', paneId, split: 'v', rect: { left: b.left, top: body.top + body.height / 2, width: b.width, height: body.height / 2 } };
      if (fromPane && fromPane.id === paneId) return null;
      return { kind: 'zone', paneId, rect: { left: b.left, top: body.top, width: b.width, height: body.height } };
    }
    function dragEnd(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d0 = drag, g = d0.on ? d0.tgt : null; cleanup();
      if (!d0.on) return;
      d0.suppress = true; suppressClick = Date.now();
      if (!g) return;
      const pl = d0.payload;
      if (pl.tab) {
        if (g.split) { const r = D.moveToNew(L, pl.tab, g.split, g.paneId, maxPanes()); if (r) changed(r.L, 'shape'); }
        else changed(D.move(L, pl.tab, g.paneId, g.index), 'shape');
      } else if (pl.k) {
        if (g.split) { const s = D.split(L, g.paneId, g.split, maxPanes()); if (s) { L = s.L; openItem(pl.k, pl.r, { pane: s.paneId }); } }
        else { const tabId = openItem(pl.k, pl.r, { pane: g.paneId }); if (tabId && g.index != null) { const pp = D.paneOfTab(L, tabId); if (pp && pp.id === g.paneId) changed(D.move(L, tabId, g.paneId, g.index), 'shape'); } }
      }
    }
    let suppressClick = 0;
    function dragCancel() { cleanup(); }
    function cleanup() {
      if (!drag) return; clearTimeout(drag.lp);
      if (drag.ghost) drag.ghost.remove(); if (drag.ind) drag.ind.remove();
      document.documentElement.classList.remove('dk-dragging');
      document.removeEventListener('touchmove', blockTouch, { passive: false });
      window.removeEventListener('pointermove', dragMove); window.removeEventListener('pointerup', dragEnd); window.removeEventListener('pointercancel', dragCancel);
      drag = null;
    }

    /* ---------- splitters ---------- */
    function splitDrag(e, sp) {
      const sid = sp.dataset.s, i = +sp.dataset.i, box = sp.parentElement, vert = box.classList.contains('dk-v');
      const f = (function find(n) { if (n.id === sid) return n; if (n.t === 's') for (const c of n.c) { const r = find(c); if (r) return r; } return null; })(L.root); if (!f) return;
      const kids = [...box.children].filter(x => !x.classList.contains('dk-sp')), r = box.getBoundingClientRect(), total = vert ? r.height : r.width;
      const w = f.w.slice(), before = w.slice(0, i).reduce((a, b) => a + b, 0), pair = w[i] + w[i + 1];
      sp.setPointerCapture(e.pointerId); sp.classList.add('on'); document.documentElement.classList.add('dk-resizing');
      const mv = ev => { const pos = ((vert ? ev.clientY - r.top : ev.clientX - r.left) / total); const a = Math.max(D.MIN_W, Math.min(pair - D.MIN_W, pos - before)); w[i] = a; w[i + 1] = pair - a; kids[i].style.flex = w[i] + ' 1 0px'; kids[i + 1].style.flex = w[i + 1] + ' 1 0px'; sp.setAttribute('aria-valuenow', Math.round(w[i] * 100)); };
      const up = () => { sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); sp.removeEventListener('pointercancel', up); sp.classList.remove('on'); document.documentElement.classList.remove('dk-resizing'); changed(D.setSizes(L, sid, w), 'shape'); };
      sp.addEventListener('pointermove', mv, { passive: true }); sp.addEventListener('pointerup', up); sp.addEventListener('pointercancel', up);
    }

    /* ---------- events ---------- */
    function wire() {
      barEl.addEventListener('click', e => {
        const b = e.target.closest('[data-b]'); if (!b) return; const k = b.dataset.b;
        if (k === 'rail') setRail(!railCollapsed()); else if (k === 'desks') deskMenu(b); else if (k === 'open') palette();
        else if (k === 'split-h') splitPane(L.act, 'h'); else if (k === 'split-v') splitPane(L.act, 'v'); else if (k === 'sheet') openSheet();
      });
      const railClick = e => {
        if (Date.now() - suppressClick < 400) return;
        const sh = e.target.closest('[data-sec]'); if (sh) { const o = Object.assign({}, (A.M.deskRail || {}).open || {}); o[sh.dataset.sec] = !secOpen(sh.dataset.sec); A.M.deskRail = Object.assign({}, A.M.deskRail || {}, { open: o }); A.saveMeta(); drawRail(); return; }
        const it = e.target.closest('.dk-it'); if (it) { openItem(it.dataset.k, it.dataset.r, { beside: e.shiftKey || e.altKey }); return; }
        const ri = e.target.closest('[data-ri]'); if (ri) { const o = Object.assign({}, (A.M.deskRail || {}).open || {}); o[ri.dataset.ri] = true; A.M.deskRail = Object.assign({}, A.M.deskRail || {}, { open: o, c: false }); A.saveMeta(); drawRail(); drawBar(); return; }
        const b = e.target.closest('[data-b]'); if (!b) return;
        if (b.dataset.b === 'add-doc') A.pickFiles({}); else if (b.dataset.b === 'new-note') newNote({}); else if (b.dataset.b === 'new-nb') newNotebook({});
      };
      railEl.addEventListener('click', railClick);
      sheetEl.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) { closeSheet(); return; } railClick(e); });
      const railInput = e => { if (e.target.type === 'search') { railQ = e.target.value; e.target.closest('.dk-sheet') ? drawSheet() : drawRail(); } };
      railEl.addEventListener('input', railInput); sheetEl.addEventListener('input', railInput);
      railEl.addEventListener('keydown', e => { if (e.key === '/') e.stopPropagation(); });
      railEl.addEventListener('pointerdown', e => { const it = e.target.closest('.dk-it'); if (it) dragStart(e, { k: it.dataset.k, r: it.dataset.r }, it.querySelector('.n').textContent); });
      railEl.addEventListener('contextmenu', e => { const it = e.target.closest('.dk-it'); if (!it) return; e.preventDefault(); const k = it.dataset.k, r = it.dataset.r;
        menu({ x: e.clientX, y: e.clientY }, [{ l: t('Open', 'Åpne'), f: () => openItem(k, r) }, { l: t('Open beside', 'Åpne ved siden av'), f: () => openItem(k, r, { beside: true }), hide: isPhone() },
          { l: t('Show in the Library', 'Vis i biblioteket'), f: () => A.go(k === 'doc' ? 'documents/' + r : k === 'note' ? 'notes/' + r : k === 'aircraft' ? 'aircraft/' + r : k === 'pack' ? 'packs' : 'routes'), hide: k === 'notebook' || k === 'ask' }]); });

      mainEl.addEventListener('pointerdown', e => {
        const paneE = e.target.closest('.dk-pane');
        if (paneE && paneE.dataset.pane !== 'phone' && paneE.dataset.pane !== L.act && D.paneById(L, paneE.dataset.pane)) { L = D.activate(L, paneE.dataset.pane); panesEl.forEach((pe, id) => pe.el.classList.toggle('act', D.panes(L).length > 1 && id === L.act)); views.forEach(v => { if (v.ctxChanged) v.ctxChanged(); }); changed(L, 'pos'); }
        const sp = e.target.closest('.dk-sp'); if (sp) { e.preventDefault(); splitDrag(e, sp); return; }
        const tb = e.target.closest('.dk-tab'); if (tb && !e.target.closest('.x')) { const x = D.tabById(L, tb.dataset.tab); if (x) dragStart(e, { tab: x.id }, typeOf(x.k).title(x.r)); }
      }, { passive: false });
      mainEl.addEventListener('click', e => {
        if (Date.now() - suppressClick < 400) return;
        const x = e.target.closest('[data-x]'); if (x) { changed(D.close(L, x.dataset.x, true), 'shape'); return; }
        const tb = e.target.closest('.dk-tab'); if (tb) { activateTab(tb.dataset.tab); return; }
        const pa = e.target.closest('[data-pa]'); if (pa) { const paneId = pa.closest('.dk-pane').dataset.pane;
          if (pa.dataset.pa === 'menu') paneMenu(pa, paneId === 'phone' ? L.act : paneId);
          else if (pa.dataset.pa === 'beside') { const p = D.paneById(L, paneId); if (!p || !p.a) return; const n = D.nextPane(L, p.id); if (n) changed(D.move(L, p.a, n.id), 'shape'); else { const r = D.moveToNew(L, p.a, 'h', null, maxPanes()); if (r) changed(r.L, 'shape'); } }
          return; }
        const sw = e.target.closest('[data-b="switch"]'); if (sw) { switcher(sw); return; }
        const rc = e.target.closest('.dk-empty [data-k]'); if (rc) openItem(rc.dataset.k, rc.dataset.r, { beside: e.shiftKey || e.altKey });
      });
      mainEl.addEventListener('auxclick', e => { if (e.button !== 1) return; const tb = e.target.closest('.dk-tab'); if (tb) { e.preventDefault(); changed(D.close(L, tb.dataset.tab), 'shape'); } });
      mainEl.addEventListener('contextmenu', e => { const tb = e.target.closest('.dk-tab'); if (tb) { e.preventDefault(); tabMenu({ x: e.clientX, y: e.clientY }, tb.dataset.tab); } });
      mainEl.addEventListener('dblclick', e => { const sp = e.target.closest('.dk-sp'); if (sp) { const f = (function find(n) { if (n.id === sp.dataset.s) return n; if (n.t === 's') for (const c of n.c) { const r = find(c); if (r) return r; } return null; })(L.root); if (f) changed(D.setSizes(L, f.id, f.w.map(() => 1)), 'shape'); } });
      mainEl.addEventListener('keydown', e => {
        const sp = e.target.closest('.dk-sp');
        if (sp) { const vert = sp.getAttribute('aria-orientation') === 'horizontal', dec = vert ? 'ArrowUp' : 'ArrowLeft', inc = vert ? 'ArrowDown' : 'ArrowRight';
          if (e.key === dec || e.key === inc) { e.preventDefault(); changed(D.nudge(L, sp.dataset.s, +sp.dataset.i, e.key === inc ? 0.03 : -0.03), 'shape'); const n = mainEl.querySelector(`.dk-sp[data-s="${sp.dataset.s}"][data-i="${sp.dataset.i}"]`); if (n && n !== document.activeElement) n.focus(); }
          else if (e.key === 'Enter') { e.preventDefault(); const f = (function find(n) { if (n.id === sp.dataset.s) return n; if (n.t === 's') for (const c of n.c) { const r = find(c); if (r) return r; } return null; })(L.root); if (f) changed(D.setSizes(L, f.id, f.w.map(() => 1)), 'shape'); }
          return; }
        const tb = e.target.closest('.dk-tab'); if (!tb) return;
        const all = [...tb.parentElement.querySelectorAll('.dk-tab')], i = all.indexOf(tb);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; n.focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(tb.dataset.tab); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); changed(D.close(L, tb.dataset.tab, true), 'shape'); }
        else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); tabMenu(tb, tb.dataset.tab); }
      });
      /* files dropped on the desk are added to the library and opened where they land */
      mainEl.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); mainEl.classList.add('filedrop'); } });
      mainEl.addEventListener('dragleave', e => { if (e.target === mainEl || !mainEl.contains(e.relatedTarget)) mainEl.classList.remove('filedrop'); });
      mainEl.addEventListener('drop', e => { mainEl.classList.remove('filedrop'); if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); const pe = e.target.closest('.dk-pane'); if (pe && D.paneById(L, pe.dataset.pane)) L = D.activate(L, pe.dataset.pane); A.addFiles([...e.dataTransfer.files]); });
    }
    document.addEventListener('keydown', e => {
      if (!mounted || host.hidden) return;
      const dlg = document.getElementById('wsDlg'); if (dlg && dlg.open) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopPropagation(); closeMenu(); palette(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); splitPane(L.act, e.shiftKey ? 'v' : 'h'); }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === ']' || e.key === '[' || e.key === '}' || e.key === '{')) { e.preventDefault(); switchTab(e.key === ']' || e.key === '}' ? 1 : -1); }
      else if (e.key === 'Escape') { closeMenu(); closeSheet(); }
    }, true);
    let rzT = 0;
    window.addEventListener('resize', () => { if (!mounted) return; clearTimeout(rzT); rzT = setTimeout(() => { sizeHost(); const ph = isPhone(); if (ph !== phoneMode) { drawBar(); drawRail(); render(true); } else { drawBar(); } }, 120); }, { passive: true });
    window.addEventListener('pagehide', snapshot);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') snapshot(); });
    window.LAB.onLang(() => { if (!mounted) return; collectStates(); unmountViews(); drawBar(); drawRail(); render(true); });

    /* helpers for notebook.js and ask.js */
    const EXT = { A, D, W, t, esc, h, ic, menu, missing, toast: A.toast, isPhone, openItem: (k, r, o) => openItem(k, r, o), drawTabTitles, pdfLabel, docBeside, lang: () => t('en', 'no') };
    if (window.WSNB) window.WSNB.init(EXT);
    if (window.WSASK) window.WSASK.init(EXT);
    window.WSDESK = { show, hide, status, refresh,
      openItem: (k, r, o) => openItem(k, r, o), types: TYPES,
      switchDesk: id => { if (mounted) switchDesk(id); else { A.M.desk = id; A.saveMeta(); } },
      get layout() { return L; }, get desk() { return desk; }, views, save: snapshot };
  };
})();
