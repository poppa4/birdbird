/* Birdbird – My Workspace desk, layout model (no DOM, no storage): runs in the browser (window.DESKCORE) and in node tests.
   A desk is one item of kind 'desk' in the 'workspace' sync namespace: { id, kind:'desk', name, L, createdAt, updatedAt }.
   L, the layout, holds positions only, never content:
     L      { root: node, act: id of the active pane }
     node   pane  { t:'p', id, tabs:[tab], a: id of the active tab or null }
            split { t:'s', id, d:'h' (side by side) | 'v' (stacked), w:[fractions, sum 1], c:[node, node, …] }
     tab    { id, k: item type ('doc' 'note' 'aircraft' 'pack' 'route' 'notebook' …), r: item id, pin?:1, st?:{ p, z, y } }
   An item is open at most once per desk; opening it again shows the tab that already has it.
   Every function returns a new layout and leaves its input untouched. */
(function (G) {
  'use strict';
  const MAX_PANES = 4, MAX_TABS = 40, MAX_DESKS = 24, MIN_W = 0.14;
  const TYPES = ['doc', 'note', 'aircraft', 'pack', 'route', 'notebook'];
  let seq = 0;
  const rid = p => p + Date.now().toString(36).slice(-5) + (seq++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
  const clone = o => JSON.parse(JSON.stringify(o));
  const pane = () => ({ t: 'p', id: rid('p'), tabs: [], a: null });
  const newLayout = () => { const p = pane(); return { root: p, act: p.id }; };

  /* ---------- reading ---------- */
  function panes(L) { const out = []; (function walk(n) { if (!n) return; if (n.t === 'p') out.push(n); else n.c.forEach(walk); })(L && L.root); return out; }
  const paneById = (L, id) => panes(L).find(p => p.id === id) || null;
  const activePane = L => paneById(L, L.act) || panes(L)[0];
  function paneOfTab(L, tabId) { return panes(L).find(p => p.tabs.some(x => x.id === tabId)) || null; }
  function tabById(L, tabId) { for (const p of panes(L)) { const x = p.tabs.find(y => y.id === tabId); if (x) return x; } return null; }
  function findItem(L, k, r) { for (const p of panes(L)) { const x = p.tabs.find(y => y.k === k && y.r === r); if (x) return { pane: p, tab: x }; } return null; }
  function parentOf(node, id, par) { if (!node) return null; if (node.id === id) return { par: par || null, node }; if (node.t === 's') for (const c of node.c) { const f = parentOf(c, id, node); if (f) return f; } return null; }
  const allTabs = L => panes(L).flatMap(p => p.tabs);
  const activeTab = L => { const p = activePane(L); return p && p.tabs.find(x => x.id === p.a) || null; };
  /* the pane order for "next pane": left to right, top to bottom */
  function nextPane(L, paneId) { const ps = panes(L), i = ps.findIndex(p => p.id === paneId); if (ps.length < 2) return null; return ps[i + 1] || ps[i - 1] || null; }
  /* fractions that sum to 1 with none below MIN_W */
  function clampW(w) {
    const n = w.length; if (n * MIN_W >= 1) return w.map(() => 1 / n);
    let x = norm(w.map(v => Math.max(0, +v || 0))); const fixed = new Set();
    for (let k = 0; k < n; k++) {
      const low = x.map((v, i) => i).filter(i => !fixed.has(i) && x[i] < MIN_W); if (!low.length) break;
      low.forEach(i => fixed.add(i));
      const rest = 1 - fixed.size * MIN_W, free = x.reduce((a, v, i) => a + (fixed.has(i) ? 0 : v), 0) || 1;
      x = x.map((v, i) => fixed.has(i) ? MIN_W : v / free * rest);
    }
    return x;
  }
  const pinnedCount = p => p.tabs.filter(x => x.pin).length;
  const norm = w => { const s = w.reduce((a, b) => a + b, 0) || 1; return w.map(x => x / s); };

  /* ---------- changing ---------- */
  function activate(L0, paneId, tabId) {
    const L = clone(L0), p = paneById(L, paneId); if (!p) return L;
    L.act = p.id; if (tabId && p.tabs.some(x => x.id === tabId)) p.a = tabId; return L;
  }
  /* split the pane: dir 'h' puts a new empty pane to the right, 'v' below. -> { L, paneId } or null when the desk is full */
  function split(L0, paneId, dir, max) {
    const L = clone(L0); dir = dir === 'v' ? 'v' : 'h';
    if (panes(L).length >= Math.min(max || MAX_PANES, MAX_PANES)) return null;
    const f = parentOf(L.root, paneId); if (!f || f.node.t !== 'p') return null;
    const np = pane();
    if (f.par && f.par.d === dir) {
      const i = f.par.c.indexOf(f.node), half = f.par.w[i] / 2;
      f.par.c.splice(i + 1, 0, np); f.par.w.splice(i, 1, half, half);
    } else {
      const s = { t: 's', id: rid('s'), d: dir, w: [0.5, 0.5], c: [f.node, np] };
      if (!f.par) L.root = s; else f.par.c[f.par.c.indexOf(f.node)] = s;
    }
    L.act = np.id;
    return { L, paneId: np.id };
  }
  /* remove a pane (its tabs go with it), fold a split that is left with one child into its parent */
  function removePane(L0, paneId) {
    const L = clone(L0); if (panes(L).length < 2) return L;
    const order = panes(L).map(p => p.id), f = parentOf(L.root, paneId); if (!f || !f.par) return L;
    const s = f.par, i = s.c.indexOf(f.node);
    s.c.splice(i, 1); const gone = s.w.splice(i, 1)[0]; s.w[Math.max(0, i - 1)] += gone; s.w = norm(s.w);
    if (s.c.length === 1) {
      const only = s.c[0], g = parentOf(L.root, s.id);
      if (!g.par) L.root = only;
      else { const j = g.par.c.indexOf(s);
        if (only.t === 's' && only.d === g.par.d) { const share = g.par.w[j]; g.par.c.splice(j, 1, ...only.c); g.par.w.splice(j, 1, ...only.w.map(x => x * share)); }
        else g.par.c[j] = only; }
    }
    if (L.act === paneId || !paneById(L, L.act)) { const k = order.indexOf(paneId); const ids = panes(L).map(p => p.id); L.act = ids[Math.max(0, Math.min(ids.length - 1, k - 1))]; }
    return L;
  }
  function insertAt(p, tab, index) {
    const pc = pinnedCount(p);
    let i = index == null ? p.tabs.length : index;
    i = tab.pin ? Math.min(i, pc) : Math.max(i, pc);
    p.tabs.splice(Math.max(0, Math.min(p.tabs.length, i)), 0, tab);
  }
  /* open an item. opts: { pane, beside, dir, max, st }. -> { L, tabId, paneId, existed } */
  function open(L0, k, r, opts) {
    opts = opts || {}; let L = clone(L0);
    const have = findItem(L, k, r);
    if (have) { L.act = have.pane.id; have.pane.a = have.tab.id; return { L, tabId: have.tab.id, paneId: have.pane.id, existed: true }; }
    let p = paneById(L, opts.pane) || activePane(L);
    if (opts.beside) {
      const n = nextPane(L, p.id);
      if (n) p = n;
      else { const s = split(L, p.id, opts.dir || 'h', opts.max); if (s) { L = s.L; p = paneById(L, s.paneId); } }
    }
    if (p.tabs.length >= MAX_TABS) { const old = p.tabs.find(x => !x.pin && x.id !== p.a); if (old) p.tabs.splice(p.tabs.indexOf(old), 1); else return { L: clone(L0), tabId: null, paneId: p.id, existed: false, full: true }; }
    const tab = { id: rid('t'), k, r: String(r) };
    if (opts.st) tab.st = cleanSt(opts.st);
    const ai = p.tabs.findIndex(x => x.id === p.a);
    insertAt(p, tab, ai < 0 ? null : ai + 1);
    p.a = tab.id; L.act = p.id;
    return { L, tabId: tab.id, paneId: p.id, existed: false };
  }
  /* close a tab. A pinned tab stays unless force. A pane left empty is removed (unless it is the last one). */
  function close(L0, tabId, force) {
    let L = clone(L0); const p = paneOfTab(L, tabId); if (!p) return L;
    const i = p.tabs.findIndex(x => x.id === tabId); if (p.tabs[i].pin && !force) return L;
    p.tabs.splice(i, 1);
    if (p.a === tabId) p.a = (p.tabs[i] || p.tabs[i - 1] || {}).id || null;
    if (!p.tabs.length && panes(L).length > 1) L = removePane(L, p.id);
    return L;
  }
  function closeOthers(L0, tabId) { const L = clone(L0), p = paneOfTab(L, tabId); if (!p) return L; p.tabs = p.tabs.filter(x => x.id === tabId || x.pin); p.a = tabId; return L; }
  /* move a tab to a pane (the same one = reorder). index counts in the target's list before the move. */
  function move(L0, tabId, toPaneId, index) {
    let L = clone(L0); const from = paneOfTab(L, tabId), to = paneById(L, toPaneId); if (!from || !to) return L;
    const i = from.tabs.findIndex(x => x.id === tabId), tab = from.tabs[i];
    if (from === to && index != null && index > i) index--;
    from.tabs.splice(i, 1);
    if (from.a === tabId) from.a = (from.tabs[i] || from.tabs[i - 1] || {}).id || null;
    insertAt(to, tab, index);
    to.a = tab.id; L.act = to.id;
    if (from !== to && !from.tabs.length) L = removePane(L, from.id);
    return L;
  }
  /* move a tab into a new pane beside its own (or beside another pane). -> { L, paneId } or null when full */
  function moveToNew(L0, tabId, dir, nearPaneId, max) {
    const src = paneOfTab(L0, tabId); if (!src) return null;
    if (!nearPaneId && src.tabs.length < 2) return null;            // nothing would be left behind
    const s = split(L0, nearPaneId || src.id, dir, max); if (!s) return null;
    return { L: move(s.L, tabId, s.paneId, 0), paneId: s.paneId };
  }
  function pin(L0, tabId, on) {
    const L = clone(L0), p = paneOfTab(L, tabId); if (!p) return L;
    const i = p.tabs.findIndex(x => x.id === tabId), tab = p.tabs.splice(i, 1)[0];
    if (on) tab.pin = 1; else delete tab.pin;
    insertAt(p, tab, on ? pinnedCount(p) : pinnedCount(p));
    return L;
  }
  function setSizes(L0, splitId, w) {
    const L = clone(L0), f = parentOf(L.root, splitId); if (!f || f.node.t !== 's' || !Array.isArray(w) || w.length !== f.node.c.length) return L;
    f.node.w = clampW(w); return L;
  }
  /* move the border between child i and i+1 of a split by delta (a fraction of the split) */
  function nudge(L0, splitId, i, delta) {
    const f = parentOf(L0.root, splitId); if (!f || f.node.t !== 's' || i < 0 || i >= f.node.c.length - 1) return L0;
    const w = f.node.w.slice(), sum = w[i] + w[i + 1];
    let a = Math.max(MIN_W, Math.min(sum - MIN_W, w[i] + delta)); w[i] = a; w[i + 1] = sum - a;
    return setSizes(L0, splitId, w);
  }
  const num = (v, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined; };
  function cleanSt(st) {
    st = st || {}; const o = {};
    const p = num(st.p, 1, 99999), z = num(st.z, 0.25, 6), y = num(st.y, 0, 1e7), o2 = num(st.o, 0, 1);
    if (p !== undefined) o.p = Math.round(p); if (z !== undefined) o.z = Math.round(z * 100) / 100; if (y !== undefined) o.y = Math.round(y); if (o2 !== undefined) o.o = Math.round(o2 * 1000) / 1000;
    if (st.v === 'text' || st.v === 'file') o.v = st.v;
    return o;
  }
  function setState(L0, tabId, st) {
    const L = clone(L0), t = tabById(L, tabId); if (!t) return L;
    const s = cleanSt(Object.assign({}, t.st || {}, st)); if (Object.keys(s).length) t.st = s; else delete t.st;
    return L;
  }
  /* remove tabs whose item is gone for good: keep(k, r) -> false drops the tab */
  function prune(L0, keep) {
    let L = clone(L0);
    for (const p of panes(L)) { const before = p.tabs.length; p.tabs = p.tabs.filter(x => keep(x.k, x.r)); if (p.tabs.length !== before && !p.tabs.some(x => x.id === p.a)) p.a = (p.tabs[0] || {}).id || null; }
    for (const p of panes(L)) if (!p.tabs.length && panes(L).length > 1) L = removePane(L, p.id);
    return L;
  }

  /* ---------- from storage or another device: never trust the shape ---------- */
  const ID = /^[A-Za-z0-9_-]{1,40}$/, REF = /^[A-Za-z0-9_:.\-]{1,100}$/, KIND = /^[a-z]{2,12}$/;
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || !raw.root) return newLayout();
    const seenTab = new Set(), seenItem = new Set(), seenNode = new Set(); let nPanes = 0;
    function walk(n, depth) {
      if (!n || typeof n !== 'object' || depth > 6) return null;
      const id = ID.test(n.id) && !seenNode.has(n.id) ? n.id : rid(n.t === 's' ? 's' : 'p'); seenNode.add(id);
      if (n.t === 's') {
        const kids = [], ws = []; (Array.isArray(n.c) ? n.c : []).forEach((c, i) => { const x = walk(c, depth + 1); if (x) { kids.push(x); ws.push(Math.max(MIN_W, +((n.w || [])[i]) || 0) || 1); } });
        if (!kids.length) return null; if (kids.length === 1) return kids[0];
        return { t: 's', id, d: n.d === 'v' ? 'v' : 'h', w: norm(ws), c: kids };
      }
      if (n.t !== 'p' || nPanes >= MAX_PANES) return null; nPanes++;
      const tabs = [];
      (Array.isArray(n.tabs) ? n.tabs : []).forEach(x => {
        if (!x || !KIND.test(x.k) || !REF.test(String(x.r || '')) || tabs.length >= MAX_TABS) return;
        const key = x.k + ':' + x.r; if (seenItem.has(key)) return; seenItem.add(key);
        const tid = ID.test(x.id) && !seenTab.has(x.id) ? x.id : rid('t'); seenTab.add(tid);
        const tab = { id: tid, k: x.k, r: String(x.r) }; if (x.pin) tab.pin = 1; const st = cleanSt(x.st); if (Object.keys(st).length) tab.st = st;
        tabs.push(tab);
      });
      tabs.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
      return { t: 'p', id, tabs, a: tabs.some(x => x.id === n.a) ? n.a : (tabs[0] || {}).id || null };
    }
    const root = walk(raw.root, 0); if (!root) return newLayout();
    const L = { root, act: raw.act };
    if (!paneById(L, L.act)) L.act = panes(L)[0].id;
    return L;
  }
  /* compact text for storage: the layout of one desk (positions only) */
  const serialize = L => JSON.stringify(sanitize(L));
  const restore = s => { try { return sanitize(typeof s === 'string' ? JSON.parse(s) : s); } catch (e) { return newLayout(); } };

  /* ---------- desks as workspace items ---------- */
  const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  function newDesk(f, now) { f = f || {}; now = now || Date.now(); return { id: f.id || rid('dk'), kind: 'desk', name: cleanName(f.name) || 'Desk', L: sanitize(f.L || newLayout()), createdAt: now, updatedAt: now }; }
  /* a copy with fresh pane, split and tab ids */
  function dupDesk(d, name, now) {
    const L = clone(sanitize(d.L));
    (function walk(n) { n.id = rid(n.t === 's' ? 's' : 'p'); if (n.t === 's') n.c.forEach(walk); else { const map = {}; n.tabs.forEach(x => { const id = rid('t'); map[x.id] = id; x.id = id; }); n.a = map[n.a] || null; } })(L.root);
    L.act = panes(L)[0].id;
    return newDesk({ name: name || d.name, L }, now);
  }
  const desksOf = items => Object.values(items || {}).filter(it => it && it.kind === 'desk' && !it.deletedAt && !it.gone).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
  /* layout fingerprint without view positions (scroll, page): tells a real layout change from reading */
  const shape = L => JSON.stringify(sanitize(L), (k, v) => k === 'st' ? undefined : v);

  /* ---------- page references in notes ---------- */
  const escA = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the note text for "Name p. 4-12": a <cite> the editor makes clickable (workspacecore keeps only data-doc and data-p) */
  function citeHtml(docId, page, label, name) {
    const n = String(name || '').replace(/\s+/g, ' ').trim(); let short = n;
    if (n.length > 34) { short = n.slice(0, 33); const sp = short.lastIndexOf(' '); short = (sp > 18 ? short.slice(0, sp) : short).replace(/[\s,.;:–-]+$/, '') + '…'; }
    return '<cite data-doc="' + escA(docId) + '" data-p="' + (Math.max(1, Math.round(+page || 1))) + '">' + escA(short) + ' p. ' + escA(label || page) + '</cite>';
  }
  /* every page of a document whose text holds all the words: [{ p, n (hits), snippet }] in page order */
  function findPages(chunks, q, fold, tokens, snippet) {
    const qt = [...new Set(tokens(q))]; if (!qt.length || !chunks) return [];
    const by = new Map();
    for (const c of chunks) { const f = c.f || (c.f = fold(c.t)); if (!qt.every(t => f.includes(t))) continue; let n = 0; for (const t of qt) { let i = -1; while ((i = f.indexOf(t, i + 1)) >= 0 && n < 99) n++; } const o = by.get(c.p); if (!o) by.set(c.p, { p: c.p, n, snippet: snippet(c.t, qt, 120) }); else o.n += n; }
    return [...by.values()].sort((a, b) => a.p - b.p);
  }

  const API = { MAX_PANES, MAX_TABS, MAX_DESKS, MIN_W, TYPES, newLayout, panes, paneById, activePane, activeTab, paneOfTab, tabById, findItem, allTabs, nextPane,
    activate, split, removePane, open, close, closeOthers, move, moveToNew, pin, setSizes, nudge, setState, cleanSt, prune, sanitize, serialize, restore, shape,
    newDesk, dupDesk, desksOf, cleanName, citeHtml, findPages };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.DESKCORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
