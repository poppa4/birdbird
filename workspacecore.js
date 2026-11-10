/* Birdbird – My Workspace, core logic (no DOM, no storage): runs in the browser (window.WSCORE) and in node tests.
   Items   every aircraft, document index entry, note and pack mark is one item: { id, kind, createdAt, updatedAt, deletedAt? }.
           Deleting sets deletedAt (Trash, 30 days), then the item shrinks to a small tombstone ({ gone:1 }) so the
           deletion still reaches other devices; tombstones are dropped after 180 days.
   Sync    two namespaces on /api/sync: 'workspace' (aircraft, document index, pack marks) and 'notes'.
           Merge is per item id, newest updatedAt wins, and a concurrent edit of the same note is kept as a version.
           Absence never means deletion. A namespace that is too big is gzipped, then loses old note versions in the
           synced copy (the device keeps them), then leaves the largest notes on the device, and says so.
   Backup  one .zip (stored, no compression): birdbird-backup.json + documents/ (original files and extracted text). */
(function (G) {
  'use strict';
  const DAY = 864e5;
  const TRASH_DAYS = 30, TOMBSTONE_DAYS = 180;
  const MAX_VERSIONS = 20, VERSION_GAP = 2 * 60e3;
  const NS_BUDGET = 1400000;            // the server allows 1.5 MB per namespace; keep a margin
  const NAMESPACES = ['workspace', 'notes'];
  const nsOfKind = k => k === 'note' ? 'notes' : 'workspace';

  /* ---------- reference lists ---------- */
  const SPEEDS_SE = ['VR', 'VX', 'VY', 'VA', 'VFE', 'VNO', 'VNE', 'VS0', 'VS1', 'Best glide'];
  const SPEEDS_ME = ['VMCA', 'VR', 'VX', 'VY', 'VYSE', 'VA', 'VFE', 'VLO', 'VLE', 'VNO', 'VNE', 'VS0', 'VS1'];
  const SPEEDS_TP = ['VMCA', 'V1', 'VR', 'V2', 'VYSE', 'VA', 'VFE', 'VLO', 'VLE', 'VMO', 'MMO', 'VS0', 'VS1'];
  const AIRCRAFT_TYPES = [
    { k: 'c172', name: 'Cessna 172', trainer: 'c172.html', speeds: SPEEDS_SE },
    { k: 'da42', name: 'Diamond DA42', trainer: 'cockpit.html', speeds: SPEEDS_ME },
    { k: 'b200', name: 'King Air B200', trainer: 'b200.html', speeds: SPEEDS_TP },
    { k: 'pa28', name: 'Piper PA-28', trainer: null, speeds: SPEEDS_SE },
    { k: 'da40', name: 'Diamond DA40', trainer: null, speeds: SPEEDS_SE },
    { k: 'p2006t', name: 'Tecnam P2006T', trainer: null, speeds: SPEEDS_ME },
    { k: 'pa34', name: 'Piper PA-34 Seneca', trainer: null, speeds: SPEEDS_ME },
    { k: 'a320', name: 'Airbus A320', trainer: 'simcheck.html', speeds: ['V1', 'VR', 'V2', 'Green dot', 'S speed', 'F speed', 'VAPP', 'VMO', 'MMO'] },
    { k: 'other', name: '', trainer: null, speeds: SPEEDS_SE }
  ];
  const typeOf = k => AIRCRAFT_TYPES.find(x => x.k === k) || AIRCRAFT_TYPES[AIRCRAFT_TYPES.length - 1];
  const DOC_CATS = ['afm', 'sop', 'chk', 'company', 'charts', 'other'];
  /* Flight Intelligence document kinds <-> workspace categories (the same stored documents show in both) */
  const KIND_CAT = { afm: 'afm', fcom: 'afm', fctm: 'afm', lim: 'afm', tech: 'afm', sop: 'sop', prof: 'sop', chk: 'chk', qrh: 'chk', ref: 'company', other: 'other' };
  const CAT_KIND = { afm: 'afm', sop: 'sop', chk: 'chk', company: 'ref', charts: 'other', other: 'other' };
  const kindToCat = k => KIND_CAT[k] || 'other';
  const catToKind = c => CAT_KIND[c] || 'other';
  function guessKind(n) { n = String(n).toLowerCase(); return /qrh|emergency|abnormal/.test(n) ? 'qrh' : /fcom/.test(n) ? 'fcom' : /fctm/.test(n) ? 'fctm' : /afm|poh|flight manual|handbook/.test(n) ? 'afm' : /sop|standard operating/.test(n) ? 'sop' : /checklist|sjekkliste/.test(n) ? 'chk' : /profile/.test(n) ? 'prof' : /limit/.test(n) ? 'lim' : /easa|easy access|aip|sera|part-|regulation|om-|training manual/.test(n) ? 'ref' : 'other'; }
  function guessCat(n) { return /chart|plate|sid|star|approach|kart/i.test(n) && !/checklist/i.test(n) ? 'charts' : kindToCat(guessKind(n)); }

  /* ---------- small helpers ---------- */
  let seq = 0;
  const uid = p => (p || 'w') + Date.now().toString(36) + (seq++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  function stable(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o);
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  }
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  const byteLen = s => enc.encode(s).length;
  function fmtBytes(n) { n = +n || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' kB'; if (n < 1073741824) return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; return (n / 1073741824).toFixed(1) + ' GB'; }
  const uniq = a => [...new Set((a || []).filter(x => x != null && x !== ''))];
  const cleanTags = s => uniq((Array.isArray(s) ? s : String(s || '').split(/[,;\n]/)).map(x => String(x).trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean)).slice(0, 12);

  /* ---------- note text: a small HTML whitelist (notes travel between devices and through backup files) ---------- */
  const TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'mark', 'h3', 'p', 'div', 'br', 'ul', 'ol', 'li', 'blockquote']);
  const escText = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function sanitizeHtml(html) {
    html = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|svg|math|template|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, '');
    let out = '', i = 0; const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g; let m;
    while ((m = re.exec(html))) {
      out += escLoose(html.slice(i, m.index)); i = m.index + m[0].length;
      let t = m[1].toLowerCase(); const close = m[0][1] === '/';
      if (t === 'h1' || t === 'h2' || t === 'h4') t = 'h3';
      if (TAGS.has(t)) out += t === 'br' ? (close ? '' : '<br>') : '<' + (close ? '/' : '') + t + '>';
    }
    out += escLoose(html.slice(i));
    return out.slice(0, 400000);
  }
  /* text between tags: keep existing entities, escape stray < and > */
  const escLoose = s => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function htmlToText(html) {
    return String(html == null ? '' : html).replace(/<(br|\/p|\/div|\/li|\/h3|\/blockquote)\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const textToHtml = t => String(t || '').split(/\n/).map(l => '<div>' + (escText(l) || '<br>') + '</div>').join('');

  /* ---------- items ---------- */
  function newAircraft(f, now) {
    f = f || {}; now = now || Date.now(); const ty = typeOf(f.typeKey);
    return { id: f.id || uid('ac'), kind: 'aircraft', typeKey: ty.k, type: String(f.type || ty.name || '').trim().slice(0, 60), reg: String(f.reg || '').trim().toUpperCase().slice(0, 12), callsign: String(f.callsign || '').trim().slice(0, 20),
      notes: String(f.notes || '').slice(0, 4000), speeds: Array.isArray(f.speeds) ? f.speeds.slice(0, 40).map(cleanSpeed) : ty.speeds.map(k => ({ k, v: '', u: /^M/.test(k) ? 'M' : 'KIAS' })), isDefault: !!f.isDefault, fiac: f.fiac || '', createdAt: now, updatedAt: now };
  }
  const cleanSpeed = r => ({ k: String(r && r.k || '').slice(0, 24), v: String(r && r.v || '').slice(0, 16), u: String(r && r.u || '').slice(0, 10) });
  const aircraftName = a => a ? [a.type || (typeOf(a.typeKey).name), a.reg].filter(Boolean).join(' · ') || 'Aircraft' : '';
  function newNote(f, now) {
    f = f || {}; now = now || Date.now();
    return { id: f.id || uid('n'), kind: 'note', fmt: 'text', title: String(f.title || '').slice(0, 140), body: sanitizeHtml(f.body || ''), tags: cleanTags(f.tags), links: cleanLinks(f.links), pinned: !!f.pinned, versions: [], createdAt: now, updatedAt: now };
  }
  const LINK_TYPES = ['aircraft', 'doc', 'pack', 'lab'];
  function cleanLinks(l) { const seen = new Set(); return (Array.isArray(l) ? l : []).filter(x => x && LINK_TYPES.includes(x.t) && x.id && !seen.has(x.t + ':' + x.id) && seen.add(x.t + ':' + x.id)).map(x => ({ t: x.t, id: String(x.id).slice(0, 80) })).slice(0, 24); }
  function newDocEntry(f, now) {
    f = f || {}; now = now || Date.now();
    return { id: f.id, kind: 'doc', name: String(f.name || '').slice(0, 160), cat: DOC_CATS.includes(f.cat) ? f.cat : 'other', acIds: uniq(f.acIds), tags: cleanTags(f.tags), rev: String(f.rev || '').slice(0, 40), pages: +f.pages || 0, size: +f.size || 0, ext: String(f.ext || '').slice(0, 8), createdAt: f.createdAt || now, updatedAt: now };
  }
  const newPackMark = (packId, f, now) => Object.assign({ id: 'pk:' + packId, kind: 'pack', pinned: false, acId: '', createdAt: now || Date.now(), updatedAt: now || Date.now() }, f || {});
  const isLive = it => !!it && !it.deletedAt && !it.gone;
  const inTrash = it => !!it && !!it.deletedAt && !it.gone;
  const live = (items, kind) => Object.values(items || {}).filter(it => isLive(it) && (!kind || it.kind === kind));
  const trashed = items => Object.values(items || {}).filter(inTrash).sort((a, b) => b.deletedAt - a.deletedAt);
  const trashDaysLeft = (it, now) => Math.max(0, Math.ceil((it.deletedAt + TRASH_DAYS * DAY - (now || Date.now())) / DAY));
  /* strictly later than what the item had, so a slow device clock cannot lose an edit to its own earlier state */
  const stamp = (it, now) => Math.max(now || Date.now(), (it && it.updatedAt || 0) + 1);
  function patch(it, f, now) { const o = Object.assign({}, it, f); o.updatedAt = stamp(it, now); return o; }
  const trash = (it, now) => { const t = stamp(it, now); return Object.assign({}, it, { deletedAt: t, updatedAt: t }); };
  function restore(it, now) { const o = Object.assign({}, it); delete o.deletedAt; o.updatedAt = stamp(it, now); return o; }
  const tombstone = (it, now) => { const t = stamp(it, now); return { id: it.id, kind: it.kind, gone: 1, deletedAt: it.deletedAt || t, updatedAt: t }; };
  /* Trash older than 30 days becomes a tombstone; old tombstones are dropped. Returns what was purged so files can be removed too. */
  function purgeExpired(items, now) {
    now = now || Date.now(); const out = {}, purged = [];
    for (const id in items) {
      const it = items[id];
      if (it.gone) { if (now - it.updatedAt < TOMBSTONE_DAYS * DAY) out[id] = it; continue; }
      if (it.deletedAt && now - it.deletedAt >= TRASH_DAYS * DAY) { out[id] = tombstone(it, now); purged.push(it); continue; }
      out[id] = it;
    }
    return { items: out, purged };
  }

  /* ---------- notes: autosave with version history ---------- */
  const noteText = n => htmlToText(n.body);
  const wordCount = n => { const t = noteText(n).trim(); return t ? t.split(/\s+/).length : 0; };
  function pushVersion(versions, v) {
    const list = (versions || []).filter(x => !(x.at === v.at && x.body === v.body && x.title === v.title));
    list.push(v); list.sort((a, b) => a.at - b.at);
    return list.slice(-MAX_VERSIONS);
  }
  /* Every edit is saved at once. The text as it was before a burst of edits is kept as a version:
     a new version is taken when the newest one is older than two minutes (or when force is set). */
  function editNote(note, f, now, force) {
    now = now || Date.now(); const o = Object.assign({}, note);
    const title = f.title !== undefined ? String(f.title).slice(0, 140) : note.title;
    const body = f.body !== undefined ? sanitizeHtml(f.body) : note.body;
    const textChanged = title !== note.title || body !== note.body;
    if (textChanged && (note.body || note.title)) {
      /* vAt: when the last version was taken here (a version's own 'at' is when that text was written) */
      const last = (note.versions || [])[(note.versions || []).length - 1], taken = note.vAt || (last && last.at) || 0;
      if (force || !last || now - taken >= VERSION_GAP) { o.versions = pushVersion(note.versions, { at: note.updatedAt, title: note.title, body: note.body }); o.vAt = now; }
    }
    o.title = title; o.body = body;
    if (f.tags !== undefined) o.tags = cleanTags(f.tags);
    if (f.links !== undefined) o.links = cleanLinks(f.links);
    if (f.pinned !== undefined) o.pinned = !!f.pinned;
    o.updatedAt = stamp(note, now);
    return o;
  }
  function restoreVersion(note, at, now) {
    const v = (note.versions || []).find(x => x.at === at); if (!v) return note;
    return editNote(note, { title: v.title, body: v.body }, now, true);
  }

  /* ---------- merge ---------- */
  const content = it => { const o = Object.assign({}, it); delete o.updatedAt; delete o.versions; delete o.vAt; return stable(o); };
  /* base: time of the last successful sync on this device (0 = never). Both sides changed after it = a concurrent edit. */
  function mergeItem(a, b, base) {
    if (!a) return { item: b, conflict: false };
    if (!b) return { item: a, conflict: false };
    const same = content(a) === content(b);
    let w, l;
    if ((a.updatedAt || 0) === (b.updatedAt || 0)) { w = (isLive(a) || !isLive(b)) ? a : b; l = w === a ? b : a; }
    else { w = (a.updatedAt || 0) > (b.updatedAt || 0) ? a : b; l = w === a ? b : a; }
    if (w.gone) return { item: w, conflict: false };
    let item = w, conflict = false;
    const concurrent = !same && !l.gone && (l.updatedAt || 0) > (base || 0) && (w.updatedAt || 0) > (base || 0);
    if (w.kind === 'note') {
      let versions = w.versions || [];
      (l.versions || []).forEach(v => { versions = pushVersion(versions, v); });
      if (concurrent && (l.body !== w.body || l.title !== w.title) && (l.body || l.title)) { versions = pushVersion(versions, { at: l.updatedAt, title: l.title, body: l.body, conflict: 1 }); conflict = true; }
      if (stable(versions) !== stable(w.versions || [])) item = Object.assign({}, w, { versions });
      if (concurrent) { const tags = uniq((w.tags || []).concat(l.tags || [])).sort().slice(0, 12), links = cleanLinks((w.links || []).concat(l.links || [])).sort((x, y) => (x.t + x.id < y.t + y.id ? -1 : 1)); if (stable(tags) !== stable(w.tags || []) || stable(links) !== stable(w.links || [])) item = Object.assign({}, item, { tags, links }); if (l.pinned && !item.pinned) item = Object.assign({}, item, { pinned: true }); }
    } else if (concurrent && w.kind === 'doc') {
      const tags = uniq((w.tags || []).concat(l.tags || [])).sort().slice(0, 12), acIds = uniq((w.acIds || []).concat(l.acIds || [])).sort();
      if (stable(tags) !== stable(w.tags || []) || stable(acIds) !== stable(w.acIds || [])) item = Object.assign({}, w, { tags, acIds });
    } else if (concurrent && w.kind === 'aircraft') {
      /* keep the loser's notes if the winner has none, and any speeds the winner left empty */
      const notes = w.notes || l.notes || '';
      const speeds = (w.speeds || []).map(r => { if (r.v) return r; const o = (l.speeds || []).find(x => x.k === r.k && x.v); return o ? Object.assign({}, r, { v: o.v, u: o.u || r.u }) : r; });
      (l.speeds || []).forEach(r => { if (r.k && r.v && !speeds.some(x => x.k === r.k)) speeds.push(r); });
      if (notes !== (w.notes || '') || stable(speeds) !== stable(w.speeds || [])) item = Object.assign({}, w, { notes, speeds });
      if (inTrash(w) !== inTrash(l) || notes !== (w.notes || '')) conflict = true;
    }
    return { item, conflict };
  }
  function mergeItems(local, remote, base) {
    const items = {}, conflicts = []; let changedLocal = false, changedRemote = false;
    const ids = new Set(Object.keys(local || {}).concat(Object.keys(remote || {})));
    ids.forEach(id => {
      const a = local && local[id], b = remote && remote[id];
      const r = mergeItem(a, b, base); items[id] = r.item; if (r.conflict) conflicts.push(id);
      if (!a || stable(a) !== stable(r.item)) changedLocal = true;
      if (!b || stable(b) !== stable(r.item)) changedRemote = true;
    });
    return { items, conflicts, changedLocal, changedRemote };
  }
  function splitNs(items) { const o = { workspace: {}, notes: {} }; for (const id in items) o[nsOfKind(items[id].kind)][id] = items[id]; return o; }

  /* ---------- namespace size: gzip, then trim the synced copy ---------- */
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pipe(u8, stream) { const w = stream.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
  const canGzip = () => typeof CompressionStream !== 'undefined' && typeof Response !== 'undefined';
  async function encodeNs(items, gzip) {
    const plain = { v: 1, items };
    if (!gzip) return plain;
    return { v: 1, z: 'gzip', d: b64(await pipe(enc.encode(JSON.stringify(items)), new CompressionStream('gzip'))) };
  }
  async function unpackNs(data) {
    if (!data || typeof data !== 'object') return {};
    let items = data.items;
    if (data.z === 'gzip' && typeof data.d === 'string') { try { items = JSON.parse(dec.decode(await pipe(unb64(data.d), new DecompressionStream('gzip')))); } catch (e) { const er = new Error('unreadable'); er.code = 'unreadable'; throw er; } }
    const out = {};
    if (items && typeof items === 'object') for (const id in items) { const it = items[id]; if (it && typeof it === 'object' && it.id === id && it.kind && Number.isFinite(it.updatedAt)) out[id] = it; }
    return out;
  }
  const capVersions = (items, n) => { const o = {}; for (const id in items) { const it = items[id]; o[id] = it.versions && it.versions.length > n ? Object.assign({}, it, { versions: n ? it.versions.slice(-n) : [] }) : it; } return o; };
  /* Returns { data, items (what data holds), bytes, gz, trimmedVersions, leftOut:[ids], full } and never throws for size. */
  async function packNs(items, maxBytes, opts) {
    maxBytes = maxBytes || NS_BUDGET; const gzOk = !(opts && opts.noGzip) && canGzip();
    const total = Object.values(items).reduce((a, it) => a + ((it.versions || []).length), 0);
    const tryOne = async (set, gz) => { const data = await encodeNs(set, gz); const bytes = byteLen(JSON.stringify(data)); return { data, items: set, bytes, gz }; };
    const done = (r, set, leftOut) => Object.assign(r, { trimmedVersions: total - Object.values(set).reduce((a, it) => a + ((it.versions || []).length), 0), leftOut: leftOut || [], full: !!(leftOut && leftOut.length) });
    let r = await tryOne(items, false); if (r.bytes <= maxBytes) return done(r, items);
    if (gzOk) { r = await tryOne(items, true); if (r.bytes <= maxBytes) return done(r, items); }
    for (const n of [8, 3, 0]) { const set = capVersions(items, n); r = await tryOne(set, gzOk); if (r.bytes <= maxBytes) return done(r, set); }
    /* still too big: leave the largest items on the device, one at a time */
    let set = capVersions(items, 0); const leftOut = [];
    const sizeOf = it => JSON.stringify(it).length;
    const order = Object.values(set).filter(it => !it.gone).sort((a, b) => sizeOf(b) - sizeOf(a));
    for (const it of order) { set = Object.assign({}, set); delete set[it.id]; leftOut.push(it.id); r = await tryOne(set, gzOk); if (r.bytes <= maxBytes) break; }
    return done(r, set, leftOut);
  }

  /* ---------- sync one namespace against a transport (the browser's fetch, or the real handlers in tests) ---------- */
  /* remote: { data, version } or undefined. put(body) resolves { ok:true, version } or { ok:false, error:'conflict', current } or { ok:false, error }.
     Returns { items, version, pushed, pulled, conflicts, trimmedVersions, leftOut, error }. Local items are never dropped. */
  async function syncNs(ns, local, remote, put, opts) {
    opts = opts || {}; const base = opts.base || 0, now = opts.now || Date.now;
    let version = remote ? remote.version : 0, pushed = false, error = null, info = { trimmedVersions: 0, leftOut: [] };
    const conflicts = new Set();
    let remoteItems;
    try { remoteItems = remote ? await unpackNs(remote.data) : {}; } catch (e) { return { items: local, version, pushed: false, pulled: false, conflicts: [], trimmedVersions: 0, leftOut: [], error: 'unreadable' }; }
    let m = mergeItems(local, remoteItems, base); m.conflicts.forEach(x => conflicts.add(x));
    let merged = m.items;
    for (let tries = 0; tries < 4; tries++) {
      const p = await packNs(merged, opts.maxBytes, opts);
      info = { trimmedVersions: p.trimmedVersions, leftOut: p.leftOut };
      if (stable(p.items) === stable(remoteItems)) break;                       // the account already has exactly this
      if (!Object.keys(p.items).length && !remote) break;                       // nothing to save yet
      const r = await put({ ns, data: p.data, baseVersion: version, updatedAt: now() });
      if (r && r.ok) { version = r.version; pushed = true; error = null; break; }
      if (r && r.error === 'conflict' && r.current) {
        try { remoteItems = await unpackNs(r.current.data); } catch (e) { error = 'unreadable'; break; }
        version = r.current.version; m = mergeItems(merged, remoteItems, base); m.conflicts.forEach(x => conflicts.add(x)); merged = m.items; error = 'busy'; continue;
      }
      error = (r && r.error) || 'failed'; break;
    }
    return { items: merged, version, pushed, pulled: stable(merged) !== stable(local), conflicts: [...conflicts], trimmedVersions: info.trimmedVersions, leftOut: info.leftOut, error };
  }

  /* ---------- search ---------- */
  const fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokens = s => fold(s).split(/[^a-z0-9æøå]+/).filter(Boolean);
  /* entries: [{ t, id, title, sub, text, tags, at, href }]  ->  an index for search() */
  function buildIndex(entries) {
    return (entries || []).map(e => ({ e, title: fold(e.title), tt: tokens(e.title), tags: (e.tags || []).map(fold), sub: fold(e.sub), text: fold(e.text) }));
  }
  function snippet(text, toks, len) {
    text = String(text || '').replace(/\s+/g, ' '); if (!text) return '';
    const f = fold(text); let at = -1; for (const t of toks) { const i = f.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    len = len || 140; if (at < 0) return text.slice(0, len) + (text.length > len ? '…' : '');
    const s = Math.max(0, at - 40), cut = text.slice(s, s + len);
    return (s > 0 ? '…' : '') + cut + (s + len < text.length ? '…' : '');
  }
  /* every word of the query must match somewhere (as a prefix of a word in the title or tags, or anywhere in the text) */
  function search(index, q, limit) {
    const qt = uniq(tokens(q)); if (!qt.length) return [];
    const out = [];
    for (const r of index) {
      let score = 0, ok = true;
      for (const t of qt) {
        let s = 0;
        if (r.tt.includes(t)) s += 8; else if (r.tt.some(w => w.startsWith(t))) s += 5; else if (r.title.includes(t)) s += 3;
        if (r.tags.some(w => w === t)) s += 5; else if (r.tags.some(w => w.startsWith(t))) s += 3;
        if (r.sub && r.sub.includes(t)) s += 2;
        if (r.text) { const i = r.text.indexOf(t); if (i >= 0) s += 1 + (r.text.indexOf(t, i + 1) >= 0 ? 0.5 : 0); }
        if (!s) { ok = false; break; }
        score += s;
      }
      if (ok) out.push({ entry: r.e, score, snippet: r.e.text ? snippet(r.e.text, qt) : '' });
    }
    out.sort((a, b) => b.score - a.score || (b.entry.at || 0) - (a.entry.at || 0));
    return out.slice(0, limit || 50);
  }
  /* full text of a stored document: best matching chunk (page and snippet), or null */
  function searchChunks(chunks, q) {
    const qt = uniq(tokens(q)); if (!qt.length || !chunks) return null;
    let best = null;
    for (const c of chunks) { const f = c.f || (c.f = fold(c.t)); let n = 0; for (const t of qt) { if (f.includes(t)) n++; } if (n === qt.length) { let hits = 0; for (const t of qt) { let i = -1; while ((i = f.indexOf(t, i + 1)) >= 0 && hits < 40) hits++; } if (!best || hits > best.hits) best = { hits, p: c.p, s: c.s || '', snippet: snippet(c.t, qt) }; } }
    return best;
  }

  /* ---------- document text (same chunking as Flight Intelligence, so one stored document serves both) ---------- */
  function guessSec(t) { const m = t.match(/(?:^|\s)((?:SECTION|CHAPTER|Section|Chapter)\s+[0-9A-Z]{1,3}[\s.:–-]+[A-Z][A-Za-z ,/&-]{3,40})/); if (m) return m[1].trim(); const n = t.match(/(?:^|\s)(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+[A-Z][A-Z ,/&-]{4,40})(?=\s)/); return n ? n[1].trim() : ''; }
  const CHUNK = 1400, OVERLAP = 150;
  function chunkPage(text, p, out, sec) { text = String(text).replace(/\s+/g, ' ').trim(); if (!text) return; for (let i = 0; i < text.length; i += CHUNK - OVERLAP) out.push({ p, t: text.slice(i, i + CHUNK), s: sec || '' }); }
  function byParts(t, chunks) { const parts = String(t).split(/\n{2,}/); let acc = '', p = 1; for (const x of parts) { acc += x + '\n'; if (acc.length > 3000) { chunkPage(acc, p++, chunks, guessSec(acc.slice(0, 300))); acc = ''; } } if (acc) chunkPage(acc, p, chunks, guessSec(acc.slice(0, 300))); return p; }
  /* readable text per page from overlapping chunks */
  function pagesFromChunks(chunks) {
    const pages = []; let cur = null;
    (chunks || []).forEach(c => { if (!cur || cur.p !== c.p) { cur = { p: c.p, s: c.s || '', t: c.t }; pages.push(cur); } else cur.t += c.t.slice(OVERLAP); });
    return pages;
  }

  /* ---------- recent ---------- */
  function pushRecent(list, e, max) { const out = (list || []).filter(x => !(x.t === e.t && x.id === e.id)); out.unshift({ t: e.t, id: e.id, at: e.at || Date.now() }); return out.slice(0, max || 12); }

  /* ---------- zip (stored) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const safeName = n => String(n || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'file';
  class ZipWriter {
    constructor(now) { this.parts = []; this.central = []; this.offset = 0; const d = new Date(now || Date.now()); this.time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); this.date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); }
    /* u8: the bytes (needed for the checksum). keep: optionally a Blob holding the same bytes, stored instead of u8 to save memory. */
    add(name, u8, keep) {
      if (typeof u8 === 'string') u8 = enc.encode(u8);
      const nm = enc.encode(name), crc = crc32(u8), size = u8.length;
      if (this.offset + size > 0xFFFFFF00 || this.central.length >= 65000) { const e = new Error('The backup is larger than 4 GB.'); e.code = 'zip_too_big'; throw e; }
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, this.time, true); h.setUint16(12, this.date, true);
      h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      this.parts.push(new Uint8Array(h.buffer), nm, keep || u8);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, this.time, true); c.setUint16(14, this.date, true);
      c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, nm.length, true); c.setUint32(42, this.offset, true);
      this.central.push(new Uint8Array(c.buffer), nm);
      this.offset += 30 + nm.length + size;
    }
    /* -> array of parts for new Blob(parts) */
    finish() {
      const cdSize = this.central.reduce((a, p) => a + p.length, 0), n = this.central.length / 2;
      const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, cdSize, true); e.setUint32(16, this.offset, true);
      return this.parts.concat(this.central, [new Uint8Array(e.buffer)]);
    }
    bytes() { const parts = this.finish(); const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
  }
  /* src: Uint8Array, or anything with .size and .slice(a,b).arrayBuffer() (a File). -> [{ name, size, read() -> Uint8Array, slice() -> Blob|null }] */
  async function zipRead(src) {
    const isU8 = src instanceof Uint8Array, size = isU8 ? src.length : src.size;
    const rd = async (a, b) => isU8 ? src.subarray(a, b) : new Uint8Array(await src.slice(a, b).arrayBuffer());
    const bad = () => { const e = new Error('not a zip'); e.code = 'bad_zip'; return e; };
    if (size < 22) throw bad();
    const tailLen = Math.min(size, 65557), tail = await rd(size - tailLen, size), tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let p = -1; for (let i = tail.length - 22; i >= 0; i--) { if (tv.getUint32(i, true) === 0x06054b50) { p = i; break; } }
    if (p < 0) throw bad();
    const n = tv.getUint16(p + 10, true), cdSize = tv.getUint32(p + 12, true), cdOff = tv.getUint32(p + 16, true);
    if (cdOff + cdSize > size) throw bad();
    const cd = await rd(cdOff, cdOff + cdSize), cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
    const out = []; let o = 0;
    for (let i = 0; i < n; i++) {
      if (o + 46 > cd.length || cv.getUint32(o, true) !== 0x02014b50) throw bad();
      const method = cv.getUint16(o + 10, true), crc = cv.getUint32(o + 16, true), csize = cv.getUint32(o + 20, true), usize = cv.getUint32(o + 24, true), nl = cv.getUint16(o + 28, true), xl = cv.getUint16(o + 30, true), cl = cv.getUint16(o + 32, true), off = cv.getUint32(o + 42, true);
      const name = dec.decode(cd.subarray(o + 46, o + 46 + nl)); o += 46 + nl + xl + cl;
      if (name.endsWith('/')) continue;
      const start = async () => { const h = await rd(off, off + 30), hv = new DataView(h.buffer, h.byteOffset, h.byteLength); if (hv.getUint32(0, true) !== 0x04034b50) throw bad(); return off + 30 + hv.getUint16(26, true) + hv.getUint16(28, true); };
      out.push({ name, size: usize,
        async read() { const s = await start(); const raw = await rd(s, s + csize); let u = raw;
          if (method === 8) u = await pipe(raw, new DecompressionStream('deflate-raw')); else if (method !== 0) { const e = new Error('unsupported zip compression'); e.code = 'bad_zip'; throw e; }
          if (crc32(u) !== crc) { const e = new Error('The backup file is damaged (' + name + ').'); e.code = 'bad_crc'; throw e; }
          return u; },
        async slice(type) { if (isU8 || method !== 0) return null; const s = await start(); return src.slice(s, s + csize, type || ''); } });
    }
    return out;
  }

  /* ---------- backup ---------- */
  const BACKUP_FORMAT = 'birdbird-workspace-backup', BACKUP_NAME = 'birdbird-backup.json';
  /* input: { items, local:{ localStorage key: string }, docs:[{ doc (stored record with chunks), fileName, fileType,
       file: Uint8Array|null  or  load(): Promise<{ u8, keep: Blob|null }|null> (one file in memory at a time) }] } */
  async function buildBackup(input, now) {
    now = now || Date.now(); const z = new ZipWriter(now), index = [];
    for (const d of (input.docs || [])) {
      const doc = d.doc, meta = Object.assign({}, doc); delete meta.chunks;
      const e = { meta, text: 'documents/' + safeName(doc.id) + '.text.json', file: null };
      z.add(e.text, JSON.stringify(doc.chunks || []));
      const f = d.load ? await d.load() : (d.file ? { u8: d.file, keep: null } : null);
      if (f && f.u8) { e.file = { path: 'documents/' + safeName(doc.id) + '/' + safeName(d.fileName || doc.name), type: d.fileType || '', size: f.u8.length }; z.add(e.file.path, f.u8, f.keep || null); }
      index.push(e);
    }
    z.add(BACKUP_NAME, JSON.stringify({ format: BACKUP_FORMAT, v: 1, exportedAt: now, items: input.items || {}, local: input.local || {}, documents: index }));
    return z;
  }
  /* -> { exportedAt, items, local, docs:[{ doc, read() -> Uint8Array|null, blob(type) -> Blob|null, fileName, fileType }] } */
  async function readBackup(src) {
    const fail = m => { const e = new Error(m); e.code = 'bad_backup'; return e; };
    let entries; try { entries = await zipRead(src); } catch (e) { if (e.code === 'bad_zip') throw fail('This is not a Birdbird backup file.'); throw e; }
    const by = {}; entries.forEach(e => { by[e.name] = e; });
    if (!by[BACKUP_NAME]) throw fail('This is not a Birdbird backup file.');
    let j; try { j = JSON.parse(dec.decode(await by[BACKUP_NAME].read())); } catch (e) { if (e.code === 'bad_crc') throw e; throw fail('The backup file could not be read.'); }
    if (!j || j.format !== BACKUP_FORMAT) throw fail('This is not a Birdbird backup file.');
    const items = await unpackNs({ items: j.items });
    for (const id in items) { const it = items[id]; if (it.kind === 'note' && !it.gone) { it.body = sanitizeHtml(it.body); it.versions = (it.versions || []).map(v => ({ at: +v.at || 0, title: String(v.title || ''), body: sanitizeHtml(v.body), conflict: v.conflict ? 1 : undefined })); } }
    const docs = [];
    for (const e of (Array.isArray(j.documents) ? j.documents : [])) {
      if (!e || !e.meta || !e.meta.id) continue;
      let chunks = []; try { if (by[e.text]) chunks = JSON.parse(dec.decode(await by[e.text].read())); } catch (er) { if (er.code === 'bad_crc') throw er; }
      const fe = e.file && by[e.file.path];
      docs.push({ doc: Object.assign({}, e.meta, { chunks: Array.isArray(chunks) ? chunks : [] }), fileName: e.file ? e.file.path.split('/').pop() : '', fileType: e.file ? e.file.type : '',
        read: async () => fe ? fe.read() : null, blob: async type => fe ? (await fe.slice(type)) : null });
    }
    const local = {}; if (j.local && typeof j.local === 'object') for (const k in j.local) if (typeof j.local[k] === 'string') local[k] = j.local[k];
    return { exportedAt: j.exportedAt || 0, items, local, docs };
  }
  /* keys from a backup into this browser: stores ({id:{…updated}}) merge per id, newest wins; anything else is only set when missing */
  function mergeLocalKey(k, mine, theirs) {
    if (mine == null) return theirs;
    if (!/^naeroson-store-/.test(k)) return mine;
    try { const a = JSON.parse(mine) || {}, b = JSON.parse(theirs) || {}; const o = Object.assign({}, a); for (const id in b) { if (!o[id] || ((b[id] && b[id].updated) || 0) > ((o[id] && o[id].updated) || 0)) o[id] = b[id]; } return JSON.stringify(o); } catch (e) { return mine; }
  }

  const API = { DAY, TRASH_DAYS, TOMBSTONE_DAYS, MAX_VERSIONS, VERSION_GAP, NS_BUDGET, NAMESPACES, nsOfKind, AIRCRAFT_TYPES, typeOf, DOC_CATS, kindToCat, catToKind, guessKind, guessCat,
    uid, clone, stable, byteLen, fmtBytes, uniq, cleanTags, sanitizeHtml, htmlToText, textToHtml,
    newAircraft, aircraftName, newNote, newDocEntry, newPackMark, cleanLinks, isLive, inTrash, live, trashed, trashDaysLeft, patch, trash, restore, tombstone, purgeExpired,
    noteText, wordCount, editNote, restoreVersion, mergeItem, mergeItems, splitNs, packNs, unpackNs, syncNs,
    fold, tokens, buildIndex, search, searchChunks, snippet, guessSec, chunkPage, byParts, pagesFromChunks, pushRecent,
    crc32, safeName, ZipWriter, zipRead, buildBackup, readBackup, mergeLocalKey, BACKUP_FORMAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.WSCORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
