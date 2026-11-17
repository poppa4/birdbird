/* Birdbird – Flow trainer (flows.html). Draw a cockpit flow over your own cockpit photo or PDF, or over one of Birdbird's
   cockpit schematics (flowsac.js), in layers per role (PF/PM, CM1/CM2 or one pilot); watch it play; practise it from memory.
   Storage on this device only: flows in localStorage 'bb-flows', cockpit photos in IndexedDB 'bb-flows' (store 'img'),
   best results in 'bb-flows-best'. Nothing is sent anywhere, except the flow itself when the user shares a link or opens a
   room with a partner (flowsroom.js). */
(function () {
'use strict';
const F = window.BBFLOW, A = window.BBFLOWAC, L = o => LAB.L(o), $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'bb-flows', BEST = 'bb-flows-best';
let FL = [], cur = null, ac = null, mode = 'build', role = null, sel = null, zoom = 1, imgURL = null, imgFor = null, hidden = {}, placing = null, noteMode = false;

/* ---------- storage ---------- */
function load() { try { FL = (JSON.parse(localStorage.getItem(KEY) || '[]') || []).map(F.clean).filter(Boolean); } catch (e) { FL = []; } }
let saveT = null; const UNDO = []; let lastSnap = null;
function snap() { lastSnap = cur && !cur.ex && !cur.tmp ? JSON.stringify(cur) : null; }
function undo() { if (!UNDO.length || !cur) { msg(L({ en: 'Nothing to undo.', no: 'Ingenting å angre.' })); return; } const o = F.clean(JSON.parse(UNDO.pop())); if (!o || o.id !== cur.id) return; Object.assign(cur, o); lastSnap = JSON.stringify(cur); sel = null;
  try { localStorage.setItem(KEY, JSON.stringify(FL)); } catch (e) {} bg().then(() => { draw(); panel(); }); msg(L({ en: 'Undone.', no: 'Angret.' })); }
function save() { if (!cur || cur.ex || cur.tmp) { return; } if (lastSnap && lastSnap !== JSON.stringify(Object.assign({}, cur, { upd: JSON.parse(lastSnap).upd }))) { if (Date.now() - (save.u || 0) > 1000) { UNDO.push(lastSnap); if (UNDO.length > 40) UNDO.shift(); } save.u = Date.now(); } cur.upd = Date.now(); lastSnap = JSON.stringify(cur); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(FL)); } catch (e) { msg(L({ en: 'Could not save on this device (storage full?).', no: 'Kunne ikke lagre på denne enheten (lagringen full?).' }), 'err'); } }, 250); }
let DB = null;
function db() { return DB || (DB = new Promise((ok, ko) => { const r = indexedDB.open('bb-flows', 1); r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); })); }
const tx = (m, f) => db().then(d => new Promise((ok, ko) => { const t = d.transaction('img', m), s = t.objectStore('img'), r = f(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); }));
const imgPut = o => tx('readwrite', s => s.put(o)), imgGet = id => tx('readonly', s => s.get(id)), imgDel = id => tx('readwrite', s => s.delete(id));

/* ---------- the cockpit picture ---------- */
/* an own picture (or a free-licence photo) with spots the user has named: a cockpit whose named controls are those spots */
const picKey = f => f.ac === 'img' ? (f.img && f.img.id ? 'i:' + f.img.id : '') : A.photo(f.ac) ? 'p:' + f.ac : '';
const own = () => F.ownAc(cur, H(), '');
function marksChanged() { if (ac && ac.own) ac = own(); const k = picKey(cur); if (k && !cur.ex && !cur.tmp) FL.forEach(f => { if (f !== cur && picKey(f) === k) { f.marks = JSON.parse(JSON.stringify(cur.marks || [])); f.steps.forEach(x => { if (x.tg && !F.markFind(f, x.tg)) delete x.tg; }); } }); marksDraw(); }
function marksBorrow() { if (!cur || (cur.marks && cur.marks.length)) return; const k = picKey(cur), o = k && FL.find(f => f !== cur && picKey(f) === k && f.marks && f.marks.length); if (o) cur.marks = JSON.parse(JSON.stringify(o.marks)); }
function marksDraw() { const g = $('mk'); if (!g) return; g.innerHTML = cur && ac && ac.own && mode === 'build' ? (cur.marks || []).map(m => `<circle cx="${m.x}" cy="${m.y}" r="4.5" class="omk"><title>${esc(m.n)}</title></circle>`).join('') : ''; }
const PH = () => cur && A.photo(cur.ac), freeBg = () => cur && (cur.ac === 'img' || !!PH());
const H = () => PH() ? Math.round(1000 * PH().h / PH().w) : cur && cur.ac === 'img' ? Math.round(1000 * ((cur.img && cur.img.h) || 750) / ((cur.img && cur.img.w) || 1000)) : (ac ? ac.h : 1000);
async function bg() { const svg = $('cv'); svg.setAttribute('viewBox', `0 0 1000 ${H()}`); const g = $('bg');
  if (!cur) { g.innerHTML = ''; return; }
  const ph = PH(); if (ph) { marksBorrow(); ac = own(); g.innerHTML = `<image href="${ph.file}" x="0" y="0" width="1000" height="${H()}" preserveAspectRatio="none"/><text x="10" y="${H() - 10}" class="phc">${esc(L({ en: 'Photo', no: 'Foto' }) + ': ' + ph.by + ' · ' + ph.lic)}</text>`; return; }
  if (cur.ac !== 'img') { ac = A.get(cur.ac); g.innerHTML = ac ? A.svg(ac) : ''; svg.setAttribute('viewBox', `0 0 1000 ${H()}`);
    // a rendered cockpit shows at once in the small file, then sharpens for zooming in
    if (ac && ac.img && ac.img.hi) { const a = ac, im = new Image(); im.onload = () => { const el = g.querySelector('image'); if (el && ac === a) el.setAttribute('href', a.img.hi); }; im.src = a.img.hi; }
    return; }
  marksBorrow(); ac = own(); const id = cur.img && cur.img.id;
  if (imgFor !== id) { if (imgURL) URL.revokeObjectURL(imgURL); imgURL = null; imgFor = id; if (id) { try { const o = await imgGet(id); if (o && o.blob) imgURL = URL.createObjectURL(o.blob); } catch (e) {} } }
  g.innerHTML = imgURL ? `<image href="${imgURL}" x="0" y="0" width="1000" height="${H()}" preserveAspectRatio="none"/>` :
    `<rect width="1000" height="${H()}" fill="#20262C"/><text x="500" y="${H() / 2 - 10}" text-anchor="middle" class="nophoto">${esc(L({ en: 'No cockpit picture on this device', no: 'Ikke noe cockpitbilde på denne enheten' }))}</text><text x="500" y="${H() / 2 + 22}" text-anchor="middle" class="nophoto s">${esc(L({ en: 'Add your photo or PDF under Cockpit', no: 'Legg til bilde eller PDF under Cockpit' }))}</text>`; }
/* a second (third …) picture goes under the one that is there: overhead, panel and pedestal photos become one sheet.
   Both are drawn at the same width, so the first picture keeps its place and every step and named control stays where it is. */
async function stackPicture(file) { const old = cur.img && await imgGet(cur.img.id); if (!old) return addPicture(file); msg(L({ en: 'Reading the picture…', no: 'Leser bildet …' }));
  try { const name = file.name || 'cockpit', nw = /pdf$/i.test(file.type) || /\.pdf$/i.test(name) ? await pdfPage(file) : await shrink(file);
    const a = await createImageBitmap(old.blob), b = await createImageBitmap(nw.blob), W = Math.min(2400, Math.max(a.width, b.width)), ha = Math.round(a.height * W / a.width), hb = Math.round(b.height * W / b.width);
    if (ha + hb > 9000) { msg(L({ en: 'The sheet would be too tall. Crop the pictures first, or use fewer.', no: 'Arket blir for høyt. Beskjær bildene først, eller bruk færre.' }), 'err'); return; }
    const c = document.createElement('canvas'); c.width = W; c.height = ha + hb; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, W, ha + hb); g.drawImage(a, 0, 0, W, ha); g.drawImage(b, 0, ha, W, hb);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86)), id = 'img-' + F.uid();
    if (cur.ex) adoptExample(true); await imgPut({ id, blob, w: W, h: ha + hb, name: old.name, at: Date.now() }); const was = cur.img.id;
    FL.forEach(f => { if (f.img && f.img.id === was) f.img = { id, w: W, h: ha + hb, name: old.name }; }); imgDel(was).catch(() => {});
    save(); imgFor = null; await bg(); fit(); draw(); panel(); msg(L({ en: 'Added under the first picture. Your steps have not moved.', no: 'Lagt til under det første bildet. Stegene dine er ikke flyttet.' }), 'ok'); }
  catch (e) { msg(L({ en: 'Could not read that file: ', no: 'Kunne ikke lese filen: ' }) + (e && e.message || e), 'err'); } }
/* turn the picture a quarter clockwise; steps, notes and named controls turn with it */
async function rotatePicture() { const old = cur.img && await imgGet(cur.img.id); if (!old) return; const a = await createImageBitmap(old.blob), c = document.createElement('canvas'); c.width = a.height; c.height = a.width;
  const g = c.getContext('2d'); g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(a, 0, 0); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)), id = 'img-' + F.uid(), H0 = 1000 * old.h / old.w, k = 1000 / H0;
  const turn = o => { if (o && o.x != null && o.y != null) { const x = (H0 - o.y) * k, y = o.x * k; o.x = Math.round(x * 10) / 10; o.y = Math.round(y * 10) / 10; } };
  if (cur.ex) adoptExample(true); await imgPut({ id, blob, w: c.width, h: c.height, name: old.name, at: Date.now() }); const was = cur.img.id;
  FL.forEach(f => { if (f.img && f.img.id === was) { f.img = { id, w: c.width, h: c.height, name: old.name }; f.steps.forEach(turn); (f.notes || []).forEach(turn); (f.marks || []).forEach(turn); } }); imgDel(was).catch(() => {});
  save(); imgFor = null; await bg(); fit(); draw(); panel(); }
async function addPicture(file) { if (!file) return; msg(L({ en: 'Reading the picture…', no: 'Leser bildet …' }));
  try { let blob, w, h; const name = file.name || 'cockpit';
    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(name)) { ({ blob, w, h } = await pdfPage(file)); } else { ({ blob, w, h } = await shrink(file)); }
    const id = 'img-' + F.uid(); await imgPut({ id, blob, w, h, name, at: Date.now() });
    const old = cur.img && cur.img.id; cur.ac = 'img'; cur.img = { id, w, h, name }; cur.marks = []; cur.steps.forEach(x => { delete x.tg; }); if (old && !FL.some(f => f !== cur && f.img && f.img.id === old)) imgDel(old).catch(() => {});
    if (cur.ex) adoptExample(); save(); imgFor = null; await bg(); fit(); draw(); panel(); msg(L({ en: 'Cockpit picture added. It stays on this device.', no: 'Cockpitbildet er lagt til. Det blir på denne enheten.' }), 'ok'); }
  catch (e) { msg(L({ en: 'Could not read that file: ', no: 'Kunne ikke lese filen: ' }) + (e && e.message || e), 'err'); } }
async function shrink(file) { const bmp = await createImageBitmap(file); const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86)); return { blob, w, h }; }
async function pdfPage(file) { const lib = await import('./vendor/pdfjs/pdf.min.mjs?v=4.10.38'); lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.mjs?v=4.10.38';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise; let n = 1;
  if (pdf.numPages > 1) { const a = prompt(L({ en: `The PDF has ${pdf.numPages} pages. Which page is the cockpit?`, no: `PDF-en har ${pdf.numPages} sider. Hvilken side er cockpiten?` }), '1'); n = Math.min(pdf.numPages, Math.max(1, parseInt(a, 10) || 1)); }
  const pg = await pdf.getPage(n), v0 = pg.getViewport({ scale: 1 }), sc = Math.min(4, 2400 / Math.max(v0.width, v0.height)), v = pg.getViewport({ scale: sc });
  const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: cx, viewport: v }).promise; const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88)); pdf.destroy(); return { blob, w: c.width, h: c.height }; }

/* ---------- drawing the flow ---------- */
const col = r => (cur.style.col && cur.style.col[r]) || F.COLORS[cur.roles.indexOf(r)] || '#3CCB7F';
const NS = 'http://www.w3.org/2000/svg';
function pathD(a, b) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L0 = Math.hypot(dx, dy) || 1, k = Math.min(40, L0 * 0.12);
  const cx = mx - dy / L0 * k, cy = my + dx / L0 * k, r = 15 * cur.style.ls, ta = r / L0, tb = 1 - (r + 4) / L0;
  const q = t => [(1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y];
  const p0 = q(Math.min(.45, ta)), p1 = q(Math.max(.55, tb)); return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`; }
/* draw(o): o.upto = number of steps shown (watch), o.only = set of step ids shown (practise), o.hideAll */
function draw(o) { o = o || {}; marksDraw(); const g = $('ov'); if (!cur) { g.innerHTML = ''; return; } const ls = cur.style.ls, lw = cur.style.lw, out = [];
  const shown = cur.steps.filter((s, i) => (o.upto == null || i < o.upto) && (!o.only || o.only.has(s.id)) && !hidden[s.r] && F.placed(s) && (!o.role || s.r === o.role));
  out.push('<defs>' + cur.roles.map(r => `<marker id="ah-${r}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="${3.2}" markerHeight="${3.2}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col(r)}"/></marker>`).join('') + '</defs>');
  if (!o.hideAll) {
    cur.roles.forEach(r => { const S = shown.filter(s => s.r === r); for (let i = 1; i < S.length; i++) { const last = o.anim && i === S.length - 1 && S[i].id === o.anim;
      out.push(`<path d="${pathD(S[i - 1], S[i])}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="${lw + 3}" stroke-linecap="round"${last ? ' class="grow"' : ''}/><path d="${pathD(S[i - 1], S[i])}" fill="none" stroke="${col(r)}" stroke-width="${lw}" stroke-linecap="round" marker-end="url(#ah-${r})"${last ? ' class="grow"' : ''}/>`); } });
    shown.forEach(s => { const c = col(s.r), R = 15 * ls, on = sel === s.id, nw = o.anim === s.id, b = F.badge(cur, s), call = s.k === 'call';
      out.push(`<g class="bdg${on ? ' on' : ''}${nw ? ' nw' : ''}" data-s="${s.id}" transform="translate(${s.x} ${s.y})">` + (on ? `<circle r="${R + 7}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 3"/>` : '') +
        (call ? `<rect x="${-R}" y="${-R}" width="${2 * R}" height="${2 * R}" rx="4" fill="${c}" stroke="#0B0F12" stroke-width="2.5"/>` : `<circle r="${R}" fill="${c}" stroke="#0B0F12" stroke-width="2.5"/>`) +
        `<text y="${5.5 * ls}" text-anchor="middle" class="bn" style="font-size:${(b.length > 2 ? 11 : 15) * ls}px">${esc(call ? '☑' : b)}</text>` +
        (cur.style.lab && s.t ? `<text x="${R + 6}" y="${4 * ls}" class="bl" style="font-size:${13 * ls}px">${esc(s.t.slice(0, 40))}</text>` : '') + '</g>'); }); }
  if (mode === 'build' || o.notes) cur.notes.forEach(n => { const t = String(n.t || '').split('\n')[0].slice(0, 28) || '…';
    out.push(`<g class="note" data-n="${n.id}" transform="translate(${n.x} ${n.y})"><rect x="0" y="0" width="${Math.max(70, t.length * 7.2 + 18)}" height="30" rx="3" fill="#FFE27A" stroke="#C9A400"/><text x="9" y="20" class="nt">${esc(t)}</text></g>`); });
  g.innerHTML = out.join(''); }
function ripple(x, y, ok, keep) { const g = $('fx'), c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 10); c.setAttribute('class', 'rip ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'hint')); g.appendChild(c); setTimeout(() => c.remove(), keep || 1100); }

/* ---------- zoom ---------- */
function setZoom(z, cx, cy) { const st = $('stage'), old = zoom; zoom = Math.max(1, Math.min(5, z)); const svg = $('cv'); const fx = cx == null ? st.clientWidth / 2 : cx, fy = cy == null ? st.clientHeight / 2 : cy;
  const ax = (st.scrollLeft + fx) / old, ay = (st.scrollTop + fy) / old; svg.style.width = (zoom * 100) + '%'; st.scrollLeft = ax * zoom - fx; st.scrollTop = ay * zoom - fy; $('zl').textContent = Math.round(zoom * 100) + ' %'; }
function fit() { setZoom(1); $('stage').scrollTop = 0; }
/* phone: pinch with two fingers to zoom around the fingers, and pan with them; one finger still scrolls the stage and taps */
function pinch() { const st = $('stage'); let g = null; const two = e => { const [a, b] = e.touches, r = st.getBoundingClientRect(); return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top }; };
  st.addEventListener('touchstart', e => { if (e.touches.length === 2) { const t = two(e); g = { d: t.d, z: zoom, x: t.x, y: t.y }; SZ.told = true; } }, { passive: true });
  st.addEventListener('touchmove', e => { if (!g || e.touches.length !== 2) return; e.preventDefault(); const t = two(e); setZoom(g.z * t.d / g.d, t.x, t.y); st.scrollLeft -= t.x - g.x; st.scrollTop -= t.y - g.y; g.x = t.x; g.y = t.y; PZ.at = Date.now(); }, { passive: false });
  st.addEventListener('touchend', e => { if (e.touches.length < 2) g = null; }, { passive: true }); }
const PZ = { at: 0 };
/* phone: the cockpit stays on screen (sticky under the site's own sticky bar) while the steps scroll underneath */
function stickTop() { let top = 0; document.querySelectorAll('header,nav,.snav,[class*="sticky"],[class*="jump"]').forEach(e => { if (e.closest('#app')) return; const cs = getComputedStyle(e); if (cs.position === 'sticky' || cs.position === 'fixed') top = Math.max(top, (parseFloat(cs.top) || 0) + e.offsetHeight); }); document.documentElement.style.setProperty('--fstick', Math.min(top, 90) + 'px'); }
/* focus mode: the cockpit fills the screen (with the step bar on top in practice); back with ✕, Esc or the back gesture */
function focusMode(on) { const w = document.querySelector('.fwrap'); on = on == null ? !w.classList.contains('full') : on; if (on === w.classList.contains('full')) return;
  w.classList.toggle('full', on); document.documentElement.classList.toggle('fnoscroll', on); $('zfull').textContent = on ? '✕' : '⛶'; $('zfull').setAttribute('aria-label', on ? L({ en: 'Leave full screen', no: 'Lukk fullskjerm' }) : L({ en: 'Full screen', no: 'Fullskjerm' }));
  if (on) { try { history.pushState({ ffull: 1 }, ''); } catch (e) {} } else if (history.state && history.state.ffull) { try { history.back(); } catch (e) {} }
  requestAnimationFrame(() => setZoom(zoom)); }
addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.fwrap.full')) focusMode(false); });
addEventListener('popstate', () => { const w = document.querySelector('.fwrap'); if (w && w.classList.contains('full')) { w.classList.remove('full'); document.documentElement.classList.remove('fnoscroll'); $('zfull').textContent = '⛶'; } });

/* ---------- taps on the cockpit ---------- */
const COARSE = matchMedia('(pointer: coarse)').matches;
const tol = () => { const k = $('cv').clientWidth / 1000 || 1; return Math.max(18, (COARSE ? 22 : 14) / k); };
function pt(e) { const svg = $('cv'), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }; }
let drag = null; const SZ = { on: true, told: false }, addN = { v: '', t: 0 };
function onDown(e) { if (mode !== 'build' || !cur) return; const b = e.target.closest('.bdg,.note'); if (!b) return; e.preventDefault(); const p = pt(e);
  drag = { el: b, s: b.dataset.s ? cur.steps.find(s => s.id === b.dataset.s) : null, n: b.dataset.n ? cur.notes.find(n => n.id === b.dataset.n) : null, x0: p.x, y0: p.y, moved: false, id: e.pointerId };
  try { b.setPointerCapture(e.pointerId); } catch (x) {} }
function onMove(e) { if (!drag) return; const p = pt(e), o = drag.s || drag.n; if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) < 4) return;
  if (!drag.moved) { drag.moved = true; drag.ox = o.x; drag.oy = o.y; } o.x = Math.round((drag.ox + p.x - drag.x0) * 10) / 10; o.y = Math.round((drag.oy + p.y - drag.y0) * 10) / 10; if (drag.s) sel = drag.s.id; draw(); }
function onUp(e) { if (!drag) return; const d = drag; drag = null;
  if (d.moved) { if (d.s && ac && ac.own) { const m = d.s.tg && F.markFind(cur, d.s.tg); if (m) { m.x = d.s.x; m.y = d.s.y; marksChanged(); snapAll(); } else { const t = A.hit(ac, d.s.x, d.s.y, 2); if (t) { d.s.tg = t.id; d.s.x = Math.round(t.x + t.w / 2); d.s.y = Math.round(t.y + t.h / 2); if (!d.s.t) d.s.t = t.name; } } } else if (d.s && ac) { const t = A.hit(ac, d.s.x, d.s.y, 4); if (t) { const auto = !d.s.t || d.s.t === (A.byId(ac, d.s.tg) || {}).name; d.s.tg = t.id; d.s.x = Math.round(t.x + t.w / 2); d.s.y = Math.round(t.y + t.h / 2); if (auto) d.s.t = t.name; } else delete d.s.tg; } save(); draw(); panel(); return; }
  if (d.s) { sel = sel === d.s.id ? null : d.s.id; role = d.s.r; draw(); panel(true); } else if (d.n) editNote(d.n); }
function onClick(e) { if (!cur || drag || Date.now() - PZ.at < 350) return; if (mode === 'build' && e.target.closest('.bdg,.note')) return; const p = pt(e);   // while practising, a badge must not shield the control under it
  const k = $('cv').clientWidth / 1000, tapM = mode === 'practise' || (mode === 'together' && P.on); if (!tapM && mode !== 'build') return;
  if (SZ.on && k < 0.62 && zoom < 1.5 && (!tapM || P.on)) { const st = $('stage'), r = st.getBoundingClientRect(); setZoom(2.4, e.clientX - r.left, e.clientY - r.top); if (!SZ.told) { SZ.told = true; msg(tapM ? L({ en: 'Zoomed in so you can hit the right control: tap again to answer. Pinch or ⤢ to see it all.', no: 'Zoomet inn så du treffer riktig bryter: trykk igjen for å svare. Knip eller ⤢ for å se alt.' }) : L({ en: 'Zoomed in: tap again to place. ⤢ shows the whole cockpit.', no: 'Zoomet inn: trykk igjen for å plassere. ⤢ viser hele cockpiten.' })); } return; }
  if (tapM) return pTap(p);
  if (noteMode) { noteMode = false; const n = { id: F.uid(), x: p.x, y: p.y, t: '' }; cur.notes.push(n); save(); draw(); editNote(n); panel(); return; }
  const t = ac ? A.hit(ac, p.x, p.y, ac.own ? 2 : Math.min(10, tol() / 3)) : null, at = t ? { tg: t.id, x: Math.round(t.x + t.w / 2), y: Math.round(t.y + t.h / 2) } : { tg: undefined, x: p.x, y: p.y };
  if (cur.ex) adoptExample();
  const wait = (sel && cur.steps.find(s => s.id === sel && !F.placed(s) && s.k !== 'event')) || cur.steps.find(s => s.r === role && !F.placed(s) && s.k === 'act');
  if (wait) { Object.assign(wait, at); if (!wait.t && t) wait.t = t.name; sel = wait.id; }
  else { const s = F.addStep(cur, Object.assign({ r: role, t: t ? t.name : '' }, at)); sel = s.id; }
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) {}
  save(); draw(); panel(true); }
function editNote(n) { const t = prompt(L({ en: 'Note on the panel (FCOM reference, limitation, SOP warning). Empty to delete.', no: 'Notat på panelet (FCOM-referanse, begrensning, SOP-advarsel). Tomt for å slette.' }), n.t || '');
  if (t === null) { if (!n.t) { cur.notes = cur.notes.filter(x => x !== n); draw(); } return; } if (!t.trim()) cur.notes = cur.notes.filter(x => x !== n); else n.t = t.trim().slice(0, 400); save(); draw(); }

/* ---------- panels ---------- */
function msg(t, k) { const m = $('fmsg'); m.textContent = t || ''; m.className = 'fmsg' + (k ? ' ' + k : ''); if (t && k !== 'err') { clearTimeout(msg.t); msg.t = setTimeout(() => { if (m.textContent === t) m.textContent = ''; }, 5000); } }
/* An example is never changed. Working on it starts your own flow: building on the cockpit (tap, add, paste the SOP, new picture)
   starts an empty one on the same cockpit, so you never inherit our order; changing an example step copies the example. */
function adoptExample(copy) { const c = F.clean(JSON.parse(JSON.stringify(cur))); c.id = F.uid(); delete c.ex;
  if (copy) c.name = L({ en: 'My copy', no: 'Min kopi' }) + ' · ' + cur.name.replace(/^Example: /, '');
  else { c.steps = []; c.notes = []; c.name = L({ en: 'My flow', no: 'Min flow' }) + ' · ' + ((A.get(c.ac) || A.photo(c.ac) || {}).name || ''); }
  FL.unshift(c); cur = c; UNDO.length = 0; snap(); flowSel(); try { localStorage.setItem('bb-flows-last', c.id); } catch (e) {}
  msg(copy ? L({ en: 'Copied to My flows. Change it as you like; the example stays as it was.', no: 'Kopiert til Mine flows. Endre den som du vil; eksempelet er uendret.' }) : L({ en: 'Your own flow is started on this cockpit, empty. The example is still in the list.', no: 'Din egen flow er startet på denne cockpiten, tom. Eksempelet ligger fortsatt i listen.' }), 'ok'); }
function flowSel() { const s = $('fsel'), exL = L({ en: 'Examples (not SOPs)', no: 'Eksempler (ikke SOP)' }), exO = a => `<option value="ex:${a.id}">${esc(a.name)} · ${L({ en: 'example', no: 'eksempel' })}</option>`, ph = A.photos.filter(p => F.example(p.id, A));
  // examples are listed by aircraft size, like the cockpit picker
  const exH = A.groups.map(g => g.list.length ? `<optgroup label="${esc(exL + ' · ' + L(g))}">` + g.list.map(exO).join('') + '</optgroup>' : '').join('') + (ph.length ? `<optgroup label="${esc(exL + ' · ' + L({ en: 'Real photos', no: 'Ekte foto' }))}">` + ph.map(exO).join('') + '</optgroup>' : '');
  const opt = f => `<option value="${f.id}">${isDue(f) ? '● ' : ''}${esc(f.name)}${f.ac !== 'img' && (A.get(f.ac) || A.photo(f.ac)) && (A.get(f.ac) || A.photo(f.ac)).name !== f.name ? ' · ' + esc((A.get(f.ac) || A.photo(f.ac)).name) : ''}</option>`, mine = L({ en: 'My flows', no: 'Mine flows' });
  // flows with a flight phase are listed phase by phase, in the order of a flight; the rest under "My flows"
  const grp = (label, list) => list.length ? `<optgroup label="${esc(label)}">` + list.map(opt).join('') + '</optgroup>' : '';
  s.innerHTML = grp(mine, FL.filter(f => !f.phase)) + F.PHASES.map(p => grp(mine + ' · ' + L({ en: p[1], no: p[2] }), FL.filter(f => f.phase === p[0]))).join('') +
    exH;
  s.value = cur ? (cur.ex ? 'ex:' + cur.ac : cur.id) : ''; }
async function open(f) { stopAll(); cur = f; UNDO.length = 0; snap(); sel = null; placing = null; hidden = {}; role = f ? f.roles[0] : null; imgFor = null; await bg(); if (f && ac) { const B = JSON.stringify(f.steps.map(s => [s.x, s.y])); snapAll(); if (B !== JSON.stringify(f.steps.map(s => [s.x, s.y]))) save(); } fit(); draw(); flowSel(); panel(); setMode(mode);
  try { localStorage.setItem('bb-flows-last', f ? (f.ex ? 'ex:' + f.ac : f.id) : ''); } catch (e) {} }
function stepRow(s) { const other = cur.steps.filter(x => x.r !== s.r && x.k !== 'event'), i = cur.steps.indexOf(s);
  return `<li class="fs${sel === s.id ? ' on' : ''}${F.placed(s) || s.k !== 'act' ? '' : ' unp'}" data-s="${s.id}" style="--c:${col(s.r)}">` +
    `<span class="fbdg${s.k === 'call' ? ' call' : s.k === 'event' ? ' ev' : ''}">${s.k === 'event' ? '⚑' : esc(F.badge(cur, s))}</span>` +
    `<input class="ft" value="${esc(s.t)}" placeholder="${esc(F.placed(s) || s.k === 'event' ? L({ en: 'What to do, e.g. BAT 1+2 – ON', no: 'Hva du gjør, f.eks. BAT 1+2 – ON' }) : L({ en: 'Tap the cockpit to place it', no: 'Trykk i cockpiten for å plassere' }))}" aria-label="${esc(L({ en: 'Step text', no: 'Stegtekst' }))}">` +
    `<button class="fi" data-a="up" title="${esc(L({ en: 'Earlier', no: 'Tidligere' }))}">↑</button><button class="fi" data-a="dn" title="${esc(L({ en: 'Later', no: 'Senere' }))}">↓</button><button class="fi" data-a="more" title="${esc(L({ en: 'More', no: 'Mer' }))}" aria-expanded="${sel === s.id}">⋯</button>` +
    (sel === s.id ? `<div class="fmore"><label>${L({ en: 'Kind', no: 'Type' })} <select data-f="k"><option value="act"${s.k === 'act' ? ' selected' : ''}>${L({ en: 'Action on a control', no: 'Handling på en bryter' })}</option><option value="call"${s.k === 'call' ? ' selected' : ''}>${L({ en: 'Call: checklist or callout', no: 'Kall: sjekkliste eller callout' })}</option><option value="event"${s.k === 'event' ? ' selected' : ''}>${L({ en: 'Outside event (ATC clearance, fuel, cabin secure)', no: 'Hendelse utenfra (ATC-klarering, drivstoff, kabin klar)' })}</option></select></label>` +
      `<label>${L({ en: 'Badge text', no: 'Merketekst' })} <input data-f="b" maxlength="6" value="${esc(s.b || '')}" placeholder="${esc(F.badge(cur, Object.assign({}, s, { b: '' })))}" style="width:70px"></label>` +
      (ac && ac.own && s.k === 'act' && F.placed(s) ? `<label class="fwide">${L({ en: 'Name of this control (optional)', no: 'Navn på denne bryteren (valgfritt)' })} <input data-f="mk" maxlength="60" list="ftlist" value="${esc(s.tg || '')}" placeholder="${esc(L({ en: 'e.g. BAT 1', no: 'f.eks. BAT 1' }))}" autocomplete="off"><small>${L({ en: 'Name it once. After that you can add it by name, a tap on it snaps to it, and you can drill it under Practise.', no: 'Gi den navn én gang. Da kan du legge den til etter navn, et trykk på den fester seg, og du kan drille den under Øv.' })}</small></label>` : '') +
      (cur.roles.length > 1 ? `<label>${L({ en: 'Wait for', no: 'Vent på' })} <select data-f="after"><option value="">${L({ en: 'nothing', no: 'ingenting' })}</option>${other.map(x => `<option value="${x.id}"${s.after === x.id ? ' selected' : ''}>${esc(x.r + ' ' + F.badge(cur, x) + ' ' + (x.t || '').slice(0, 30))}</option>`).join('')}</select></label>` : '') +
      (cur.roles.length > 1 ? `<label>${L({ en: 'Layer', no: 'Lag' })} <select data-f="r">${cur.roles.map(r => `<option${r === s.r ? ' selected' : ''}>${r}</option>`).join('')}</select></label>` : '') +
      `<label class="fwide">${L({ en: 'Note (reference, limitation)', no: 'Notat (referanse, begrensning)' })} <input data-f="n" value="${esc(s.n || '')}" maxlength="400"></label>` +
      `<div class="fmb">${F.placed(s) ? `<button class="btn sm" data-a="unplace">${L({ en: 'Place again', no: 'Plasser på nytt' })}</button>` : ''}<button class="btn sm warn" data-a="del">${L({ en: 'Delete step', no: 'Slett steg' })}</button></div></div>` : '') + '</li>'; }
function panel(scroll) { const p = $('fpanel'); $('app').classList.toggle('pon', !!P.on || W.on); $('fextag').hidden = !cur || !cur.ex; if (!cur) { p.innerHTML = ''; return; } const ex = cur.ex; if (mode !== 'build' || !ex) { $('fstart').hidden = true; }
  const cockpitOpts = `<option value="img"${cur.ac === 'img' ? ' selected' : ''}>${esc(L({ en: 'My own photo or PDF', no: 'Mitt eget bilde eller PDF' }))}${cur.img && cur.img.name ? ' (' + esc(cur.img.name.slice(0, 24)) + ')' : ''}</option>` + `<optgroup label="${esc(L({ en: 'Real photos (free licence)', no: 'Ekte foto (fri lisens)' }))}">` + A.photos.map(a => `<option value="${a.id}"${cur.ac === a.id ? ' selected' : ''}>${esc(a.name)} · ${esc(L({ en: 'photo', no: 'foto' }))}</option>`).join('') + '</optgroup>' + acOpts(cur.ac);
  if (mode === 'build') {
    const R = cur.roles, unp = cur.steps.filter(s => s.r === role && !F.placed(s) && s.k === 'act').length;
    const names = ac ? A.targets(ac).map(t => t.whole ? t.name : t.name + ' · ' + t.panel) : [];
    const acN = ac ? ac.name.replace(/^(Airbus|Beechcraft|Piper|Diamond|Cessna|Boeing) /, '') : PH() ? PH().name : 'Birdbird', phs = A.photos.filter(x => x.ac === (ac ? ac.id : (PH() || {}).ac));
    const sc = $('fstart'); sc.hidden = !ex; sc.innerHTML = ex ? `<div class="fstart"><b>${L({ en: 'Make your airline’s flow', no: 'Lag flyselskapets flow' })}</b><div class="fsg">` +
      `<button class="fsb pri" id="sbird"><i>✈</i><span><b>${L({ en: `On the ${acN} cockpit`, no: `På ${acN}-cockpiten` })}</b><small>${L({ en: 'Empty flow. Tap the controls in your order.', no: 'Tom flow. Trykk bryterne i din rekkefølge.' })}</small></span></button>` +
      `<button class="fsb" id="sown"><i>📷</i><span><b>${L({ en: 'On your own photo or PDF', no: 'På ditt eget bilde eller PDF' })}</b><small>${L({ en: 'From your airline’s manual. Stays on this device.', no: 'Fra flyselskapets manual. Blir på denne enheten.' })}</small></span></button>` +
      (phs.length ? `<button class="fsb" id="sphoto"><i>🖼</i><span><b>${L({ en: 'On a real photo of the flight deck', no: 'På et ekte foto av cockpiten' })}</b><small>${L({ en: 'Empty flow on a free-licence photo', no: 'Tom flow på et fritt lisensiert foto' })}</small></span></button>` : '') +
      `<button class="fsb" id="slib"><i>👥</i><span><b>${L({ en: 'Flows from other pilots', no: 'Flows fra andre piloter' })}</b><small>${L({ en: 'Open a copy and make it yours. Not checked, not an SOP.', no: 'Åpne en kopi og gjør den til din. Ikke kontrollert, ikke en SOP.' })}</small></span></button>` +
      `<button class="fsb" id="swatch"><i>▶</i><span><b>${L({ en: 'Watch the example first', no: 'Se eksempelet først' })}</b><small>${L({ en: 'Shows how it works. Not an SOP.', no: 'Viser hvordan det virker. Ikke en SOP.' })}</small></span></button></div></div>` : '';
    p.innerHTML = (ex ? `<div class="fexnote"><b>${L({ en: 'Example, not an SOP.', no: 'Eksempel, ikke en SOP.' })}</b> ${L({ en: 'It shows how the trainer works. Your airline’s flow will differ, so make your own: tap the cockpit to start, or', no: 'Det viser hvordan treneren virker. Flyselskapets flow vil være annerledes, så lag din egen: trykk på cockpiten for å begynne, eller' })}<div class="frow"><button class="btn sm pri" id="fmine">${L({ en: 'Start my own, empty', no: 'Start min egen, tom' })}</button><button class="btn sm" id="fcopy">${L({ en: 'Copy the example and change it', no: 'Kopier eksempelet og endre det' })}</button></div></div>` : '') +
      `<div class="frow"><label class="grow">${L({ en: 'Name', no: 'Navn' })}<input id="fname" value="${esc(cur.name)}" maxlength="80"></label><label class="grow">${L({ en: 'Cockpit', no: 'Cockpit' })}<select id="fac">${cockpitOpts}</select></label></div>` +
      `<div class="frow"><label class="grow">${L({ en: 'Flight phase (optional)', no: 'Flyfase (valgfritt)' })}<select id="fph"><option value="">${L({ en: 'Not set', no: 'Ikke satt' })}</option>${F.PHASES.map(p => `<option value="${p[0]}"${cur.phase === p[0] ? ' selected' : ''}>${esc(L({ en: p[1], no: p[2] }))}</option>`).join('')}</select></label></div>` +
      (ac && ac.img && ac.img.own ? `<p class="fex fcred">${L({ en: 'Birdbird\u2019s own drawing.', no: 'Birdbirds egen tegning.' })} ${esc(ac.img.v)}. ${L({ en: 'Your aircraft can differ.', no: 'Ditt fly kan avvike.' })}</p>` : ac && ac.img ? `<p class="fex fcred">${L({ en: 'Picture rendered from the 3D model', no: 'Bildet er rendret fra 3D-modellen' })} <a href="${esc(ac.img.src)}" target="_blank" rel="noopener">${esc(ac.img.by)}</a>, <a href="${esc(ac.img.licUrl)}" target="_blank" rel="noopener">${esc(ac.img.lic)}</a>. ${ac.img.v ? esc(ac.img.v) + '. ' : ''}${L({ en: 'Your aircraft can differ.', no: 'Ditt fly kan avvike.' })}</p>` : '') +
      (PH() ? `<p class="fex fcred">${L({ en: 'Photo', no: 'Foto' })}: <a href="${esc(PH().src)}" target="_blank" rel="noopener">${esc(PH().by)}</a>, <a href="${esc(PH().licUrl)}" target="_blank" rel="noopener">${esc(PH().lic)}</a>. ${L({ en: 'Tap the photo to place each step.', no: 'Trykk på bildet for å plassere hvert steg.' })}</p>` : '') +
      `<div class="frow"><label class="btn sm pri ffile">${L({ en: cur.img ? 'Change photo or PDF…' : 'Upload cockpit photo or PDF…', no: cur.img ? 'Bytt bilde eller PDF …' : 'Last opp cockpitbilde eller PDF …' })}<input type="file" id="fimg" accept="image/*,application/pdf,.pdf" hidden></label>` +
      (cur.ac === 'img' && cur.img ? `<label class="btn sm ffile">${L({ en: 'Add a picture below…', no: 'Legg til et bilde under …' })}<input type="file" id="fimg2" accept="image/*,application/pdf,.pdf" hidden></label><button class="btn sm" id="frot" title="${esc(L({ en: 'Turn the picture a quarter clockwise', no: 'Snu bildet en kvart omdreining med klokka' }))}">↻ ${L({ en: 'Turn', no: 'Snu' })}</button>` : '') +
      (cur.ac === 'img' ? `<p class="fex fdrop">${L({ en: 'You can also drop a picture or PDF on the cockpit, or paste one (Ctrl+V). Overhead, panel and pedestal can be separate pictures: add them one under the other.', no: 'Du kan også slippe et bilde eller en PDF på cockpiten, eller lime inn (Ctrl+V). Overhead, panel og pidestall kan være egne bilder: legg dem under hverandre.' })}</p>` : '') +
      `<label>${L({ en: 'Roles', no: 'Roller' })} <select id="frs"><option value="pfpm"${cur.rs === 'pfpm' ? ' selected' : ''}>PF / PM</option><option value="cm"${cur.rs === 'cm' ? ' selected' : ''}>CM1 / CM2</option><option value="one"${cur.rs === 'one' ? ' selected' : ''}>${L({ en: 'One pilot', no: 'Én pilot' })}</option></select></label></div>` +
      `<div class="flay">${R.map(r => `<button class="fly${r === role ? ' on' : ''}" data-r="${r}" style="--c:${col(r)}"><i></i>${r} <small>${F.roleSteps(cur, r).length}</small></button><button class="feye${hidden[r] ? ' off' : ''}" data-eye="${r}" title="${esc(L({ en: 'Show or hide this layer', no: 'Vis eller skjul dette laget' }))}">${hidden[r] ? '◌' : '◉'}</button>`).join('')}</div>` +
      `<p class="fhint">${unp ? L({ en: `Tap the cockpit to place the next of ${unp} unplaced ${role} steps.`, no: `Trykk i cockpiten for å plassere neste av ${unp} uplasserte ${role}-steg.` }) : ac && !ac.own ? L({ en: `Tap a control to add the next ${role} step. Drag a badge to move it.`, no: `Trykk på en bryter for å legge til neste ${role}-steg. Dra et merke for å flytte det.` }) : L({ en: `Tap the cockpit to add the next ${role} step. Drag a badge to move it.`, no: `Trykk i cockpiten for å legge til neste ${role}-steg. Dra et merke for å flytte det.` })}</p>` +
      (ac && (!ac.own || names.length) ? `<div class="frow fadd"><label class="grow">${L({ en: 'Add a control by name', no: 'Legg til en bryter etter navn' })}<input id="fname2" list="ftlist" placeholder="${esc(L({ en: 'e.g. BAT 1, BEACON, FLAPS', no: 'f.eks. BAT 1, BEACON, FLAPS' }))}" autocomplete="off"></label><datalist id="ftlist">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>` : '') +
      `<ol class="fsteps">${cur.steps.filter(s => s.r === role).map(stepRow).join('') || `<li class="fempty">${L({ en: 'No steps yet.', no: 'Ingen steg ennå.' })}</li>`}</ol>` +
      `<div class="frow"><button class="btn sm" id="fundo"${UNDO.length ? '' : ' disabled'} title="Ctrl/⌘ Z">↶ ${L({ en: 'Undo', no: 'Angre' })}</button><button class="btn sm" id="fcall">+ ${L({ en: 'Checklist call', no: 'Sjekklistekall' })}</button><button class="btn sm" id="fev">+ ${L({ en: 'Outside event', no: 'Hendelse utenfra' })}</button><button class="btn sm" id="fsop">${L({ en: 'Paste SOP text…', no: 'Lim inn SOP-tekst …' })}</button><button class="btn sm" id="fnote">+ ${L({ en: 'Note on the panel', no: 'Notat på panelet' })}</button></div>` +
      `<details class="fsty"><summary>${L({ en: 'Lines and badges', no: 'Linjer og merker' })}</summary><div class="frow">${R.map(r => `<label>${r} <input type="color" data-col="${r}" value="${col(r)}"></label>`).join('')}<label>${L({ en: 'Line', no: 'Linje' })} <input type="range" id="flw" min="1" max="8" step="0.5" value="${cur.style.lw}"></label><label>${L({ en: 'Badge size', no: 'Merkestørrelse' })} <input type="range" id="fls" min="0.6" max="2" step="0.1" value="${cur.style.ls}"></label><label><input type="checkbox" id="flab"${cur.style.lab ? ' checked' : ''}> ${L({ en: 'Text next to badges', no: 'Tekst ved merkene' })}</label></div></details>`;
    if (scroll) inPanel(p.querySelector('.fs.on'));
  } else if (mode === 'watch') {
    p.innerHTML = `<div class="frow"><button class="btn pri" id="wplay">${W.on ? '❚❚ ' + L({ en: 'Pause', no: 'Pause' }) : '▶ ' + L({ en: 'Play', no: 'Spill av' })}</button><button class="btn" id="wrst">↺ ${L({ en: 'From the start', no: 'Fra start' })}</button>` +
      `<label>${L({ en: 'Show', no: 'Vis' })} <select id="wrole"><option value="">${L({ en: 'All roles', no: 'Alle roller' })}</option>${cur.roles.map(r => `<option${W.role === r ? ' selected' : ''}>${r}</option>`).join('')}</select></label>` +
      `<label>${L({ en: 'Speed', no: 'Fart' })} <select id="wsp">${[[2.6, L({ en: 'Slow', no: 'Sakte' })], [1.6, L({ en: 'Normal', no: 'Normal' })], [0.9, L({ en: 'Fast', no: 'Rask' })]].map(([v, n]) => `<option value="${v}"${W.dt == v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` +
      `<label><input type="checkbox" id="wspk"${W.speak ? ' checked' : ''}> ${L({ en: 'Read aloud', no: 'Les høyt' })}</label></div>` +
      `<ol class="fsteps ro">${cur.steps.filter(s => !W.role || s.r === W.role).map((s, i) => `<li class="fs${W.cur === s.id ? ' on' : ''}" data-s="${s.id}" style="--c:${col(s.r)}"><span class="fbdg${s.k === 'call' ? ' call' : s.k === 'event' ? ' ev' : ''}">${s.k === 'event' ? '⚑' : esc(F.badge(cur, s))}</span><span class="fx"><b>${s.r}</b> ${esc(s.t || '…')}${s.after ? ` <small>⏸ ${L({ en: 'waits for', no: 'venter på' })} ${esc(stepName(s.after))}</small>` : ''}</span></li>`).join('')}</ol>`;
  } else if (mode === 'together') {
    pq(); p.innerHTML = RM.code ? roomCard() + (P.live && P.i >= P.q.length ? pResult() : '') : roomForm();
  } else if (mode === 'practise') {
    pq(); p.innerHTML = P.on ? (P.i >= P.q.length ? pResult() : `<p class="fhint">${L({ en: 'Practising: the question is at the top of the cockpit. Tap where the step belongs.', no: 'Øver: spørsmålet står øverst på cockpiten. Trykk der steget hører hjemme.' })}</p><div class="frow"><button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div>`) : 
      `<div class="frow"><label>${L({ en: 'Practise', no: 'Øv' })} <select id="prole">${cur.roles.map(r => `<option value="${r}"${P.role === r ? ' selected' : ''}>${r}</option>`).join('')}${cur.roles.length > 1 ? `<option value="*"${P.role === '*' ? ' selected' : ''}>${L({ en: 'Both, in flow order', no: 'Begge, i flow-rekkefølge' })}</option>` : ''}</select></label>` +
      `<label><input type="checkbox" id="ptxt"${P.txt ? ' checked' : ''}> ${L({ en: 'Show the step text', no: 'Vis stegteksten' })}</label>` +
      (cur.roles.length > 1 ? `<label><input type="checkbox" id="pauto"${P.auto ? ' checked' : ''}> ${L({ en: 'Birdbird does the other pilot’s steps', no: 'Birdbird gjør den andre pilotens steg' })}</label>` : '') +
      `<label><input type="checkbox" id="pspk"${P.speak ? ' checked' : ''}> ${L({ en: 'Read calls aloud', no: 'Les kall høyt' })}</label>` +
      (cur.steps.some(x => x.k === 'act' && F.stateOf(x.t).st) ? `<label><input type="checkbox" id="ppos"${P.pos ? ' checked' : ''}> ${L({ en: 'Ask for the position too (ON, AUTO …)', no: 'Spør om posisjonen også (ON, AUTO …)' })}</label>` : '') + '</div>' + revTxt() +
      `<p class="fex">${L({ en: 'Choose how hard', no: 'Velg hvor vanskelig' })}</p><div class="fpc">` +
      `<button class="fsb pri" id="pgo"><i>1</i><span><b>${L({ en: 'Learn it', no: 'Lær den' })}</b><small>${L({ en: 'Tap each step in order. Hints when you need them.', no: 'Trykk hvert steg i rekkefølge. Hint når du trenger dem.' })}</small></span></button>` +
      `<button class="fsb" id="pmem"><i>2</i><span><b>${L({ en: 'From memory', no: 'Etter hukommelsen' })}</b><small>${L({ en: 'Tap the whole flow with nothing shown, then see it next to the real one.', no: 'Trykk hele flowen uten at noe vises, og se den ved siden av den riktige.' })}</small></span></button>` +
      `<button class="fsb" id="pex"><i>3</i><span><b>${L({ en: 'Check ride', no: 'Sjekkflyging' })}</b><small>${L({ en: 'One go, no hints, scored.', no: 'Ett forsøk, ingen hint, med poeng.' })}</small></span></button></div>` +
      `<div class="frow">${weak().length ? `<button class="btn sm" id="pwk">${L({ en: `Weak steps (${weak().length})`, no: `Svake steg (${weak().length})` })}</button>` : ''}<button class="btn sm" id="pord">${L({ en: 'Put the steps in order', no: 'Sett stegene i rekkefølge' })}</button><button class="btn sm" id="pfc">${L({ en: 'Flashcards', no: 'Flashcards' })}</button>${ac && !ac.own ? `<button class="btn sm" id="pfa">${L({ en: `Learn the ${ac.name} cockpit`, no: `Lær ${ac.name}-cockpiten` })}</button>` : ac && (cur.marks || []).length >= 3 ? `<button class="btn sm" id="pfa">${L({ en: `Find your named controls (${cur.marks.length})`, no: `Finn bryterne du har navngitt (${cur.marks.length})` })}</button>` : ''}</div>` + bestTxt();
  }
}
function inPanel(li) { const p = $('fpanel'); if (!li || p.scrollHeight <= p.clientHeight + 2) return; const a = li.offsetTop - p.offsetTop, b = a + li.offsetHeight; if (a < p.scrollTop) p.scrollTop = a - 8; else if (b > p.scrollTop + p.clientHeight) p.scrollTop = b - p.clientHeight + 8; }
const stepName = id => { const s = cur.steps.find(x => x.id === id); return s ? s.r + ' ' + F.badge(cur, s) + (s.t ? ' ' + s.t.slice(0, 26) : '') : '?'; };

/* panel events */
function wirePanel() { const p = $('fpanel');
  p.addEventListener('input', e => { const t = e.target; if (!cur) return;
    if (t.id === 'fph') { if (cur.ex) adoptExample(true); if (t.value) cur.phase = t.value; else delete cur.phase; save(); flowSel(); return; }
    if (t.id === 'fname') { if (cur.ex) { adoptExample(true); } cur.name = t.value.slice(0, 80) || 'Flow'; save(); flowSel(); return; }
    if (t.classList.contains('ft')) { const s = cur.steps.find(x => x.id === t.closest('.fs').dataset.s); if (s) { if (cur.ex) { adoptExample(true); } const s2 = cur.steps.find(x => x.id === s.id) || s; s2.t = t.value.slice(0, 160); save(); if (cur.style.lab) draw(); } return; }
    if (t.dataset.f === 'b' || t.dataset.f === 'n') { const s = cur.steps.find(x => x.id === t.closest('.fs').dataset.s); if (s) { s[t.dataset.f] = t.value.trim() || undefined; save(); draw(); } return; }
    if (t.dataset.col) { cur.style.col[t.dataset.col] = t.value; save(); draw(); return; }
    if (t.id === 'flw') { cur.style.lw = +t.value; save(); draw(); return; } if (t.id === 'fls') { cur.style.ls = +t.value; save(); draw(); return; } });
  p.addEventListener('change', async e => { const t = e.target; if (!cur) return;
    if (t.id === 'rname') { rName(t.value); return; }
    if (t.id === 'fname2' && ac) { if (!t.value.trim() || (addN.v === t.value && Date.now() - addN.t < 1500)) return; addN.v = t.value; addN.t = Date.now(); const v = t.value.trim().toLowerCase(), T = A.targets(ac).find(x => (x.whole ? x.name : x.name + ' · ' + x.panel).toLowerCase() === v) || A.targets(ac).find(x => x.name.toLowerCase() === v); if (!T) return;
      if (cur.ex) adoptExample(); const at = { tg: T.id, x: Math.round(T.x + T.w / 2), y: Math.round(T.y + T.h / 2) }, wait = cur.steps.find(s => s.r === role && !F.placed(s) && s.k === 'act');
      if (wait) { Object.assign(wait, at); if (!wait.t) wait.t = T.name; sel = wait.id; } else sel = F.addStep(cur, Object.assign({ r: role, t: T.name }, at)).id;
      save(); draw(); panel(true); ripple(at.x, at.y, null, 900); const n = $('fname2'); if (n) n.focus(); return; }
    if (t.id === 'fimg') { await addPicture(t.files && t.files[0]); t.value = ''; return; }
    if (t.id === 'fimg2') { const fl = t.files && t.files[0]; t.value = ''; if (fl) await stackPicture(fl); return; }
    if (t.id === 'fac') { if (cur.ex) { const e = F.example(t.value, A); if (e) { open(e); return; } adoptExample(); } const was = cur.ac; if (A.photo(t.value) && was !== t.value && cur.steps.some(F.placed)) { { cur.steps.forEach(x => { x.x = null; x.y = null; }); msg(L({ en: 'New picture: tap it to place the steps again, in order.', no: 'Nytt bilde: trykk på det for å plassere stegene på nytt, i rekkefølge.' })); } } if (was !== t.value && (was === 'img' || A.photo(was))) { delete cur.marks; cur.steps.forEach(x => { if (!A.get(t.value) || !A.byId(A.get(t.value), x.tg)) delete x.tg; }); } if (t.value === 'img') { cur.ac = 'img'; if (!cur.img) { $('fpanel').querySelector('#fimg').click(); } } else { cur.ac = t.value; } snapAll(); save(); imgFor = null; await bg(); fit(); draw(); panel(); flowSel(); return; }
    if (t.id === 'frs') { if (cur.ex) adoptExample(true); const nr = F.ROLESETS[t.value]; const map = {}; cur.roles.forEach((r, i) => map[r] = nr[Math.min(i, nr.length - 1)]); cur.steps.forEach(s => s.r = map[s.r] || nr[0]); const c = {}; nr.forEach((r, i) => c[r] = cur.style.col[cur.roles[i]] || F.COLORS[i]); cur.style.col = c; cur.roles = nr.slice(); cur.rs = t.value; role = nr[0]; save(); draw(); panel(); return; }
    if (t.id === 'flab') { cur.style.lab = t.checked; save(); draw(); return; }
    if (t.dataset.f === 'mk') { const s = cur.steps.find(x => x.id === t.closest('.fs').dataset.s); if (!s || !ac || !ac.own) return; if (cur.ex) adoptExample(true); const s2 = cur.steps.find(x => x.id === s.id) || s; if (F.markName(t.value) === (s2.tg || '')) return; F.nameSpot(cur, s2, t.value); marksChanged(); save(); draw(); panel(); return; }
    if (t.dataset.f === 'k' || t.dataset.f === 'after' || t.dataset.f === 'r') { const s = cur.steps.find(x => x.id === t.closest('.fs').dataset.s); if (!s) return; if (t.dataset.f === 'after') s.after = t.value || undefined; else s[t.dataset.f] = t.value; if (s.k === 'event') { s.x = null; s.y = null; delete s.tg; } if (t.dataset.f === 'r') role = s.r; save(); draw(); panel(); return; }
    if (t.id === 'wrole') { W.role = t.value; wReset(); panel(); return; } if (t.id === 'wsp') { W.dt = +t.value; return; } if (t.id === 'wspk') { W.speak = t.checked; return; }
    if (t.id === 'prole') { P.role = t.value; return; } if (t.id === 'ptxt') { P.txt = t.checked; return; } if (t.id === 'pauto') { P.auto = t.checked; return; } if (t.id === 'pspk') { P.speak = t.checked; return; } if (t.id === 'ppos') { P.pos = t.checked; return; } });
  p.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !cur) return;
    if (b.dataset.r) { role = b.dataset.r; sel = null; panel(); draw(); return; }
    if (b.dataset.eye) { hidden[b.dataset.eye] = !hidden[b.dataset.eye]; panel(); draw(); return; }
    const li = b.closest('.fs'), s = li && cur.steps.find(x => x.id === li.dataset.s);
    if (s && b.dataset.a) { if (cur.ex) { adoptExample(true); } const s2 = cur.steps.find(x => x.id === s.id) || s;
      if (b.dataset.a === 'up') F.moveStep(cur, s2.id, -1); else if (b.dataset.a === 'dn') F.moveStep(cur, s2.id, 1); else if (b.dataset.a === 'more') sel = sel === s2.id ? null : s2.id;
      else if (b.dataset.a === 'del') { F.delStep(cur, s2.id); sel = null; } else if (b.dataset.a === 'unplace') { s2.x = null; s2.y = null; delete s2.tg; sel = s2.id; }
      save(); draw(); panel(true); return; }
    if (b.id === 'fcall' || b.id === 'fev') { if (cur.ex) adoptExample(); const call = b.id === 'fcall'; const t = prompt(call ? L({ en: 'Which checklist or callout? (e.g. BEFORE START CHECKLIST)', no: 'Hvilken sjekkliste eller callout? (f.eks. BEFORE START CHECKLIST)' }) : L({ en: 'Which outside event starts the next steps? (e.g. ATC clearance received)', no: 'Hvilken hendelse utenfra starter de neste stegene? (f.eks. ATC-klarering mottatt)' }), call ? 'BEFORE START CHECKLIST' : '');
      if (!t) return; const st = F.addStep(cur, { r: role, k: call ? 'call' : 'event', t: t.trim().slice(0, 160), x: null, y: null }); sel = call ? st.id : null; save(); draw(); panel(true); msg(call ? L({ en: 'Tap the cockpit to put the call where it is read from, or leave it unplaced.', no: 'Trykk i cockpiten for å legge kallet der det leses fra, eller la det være uplassert.' }) : ''); return; }
    if (b.id === 'fsop') return sopDialog(); if (b.id === 'fundo') return undo();

    if (b.id === 'fnote') { noteMode = true; msg(L({ en: 'Tap the panel where the note goes.', no: 'Trykk på panelet der notatet skal stå.' })); return; }
    if (b.id === 'wplay') { W.on ? wPause() : wPlay(); return; } if (b.id === 'wrst') { wReset(); wPlay(); return; }
    if (b.id === 'ropen') return rOpen(); if (b.id === 'rjoin') { const c = ($('rjc').value || '').toLowerCase().replace(/^.*[#?&](room|c)=/, '').replace(/[^a-z0-9-]/g, ''); if (c) rJoin(c); return; }
    if (b.id === 'ragain') return rStart(true); if (b.id === 'rleave') return rLeave(); if (b.id === 'rstart') return rStart(true); if (b.id === 'rreset') { rSend({ t: 'reset' }); P.on = false; P.live = false; RM.live = false; pq(); draw(); panel(); return; }
    if (b.id === 'rcopy') { const l = location.origin + location.pathname + '#room=' + RM.code; navigator.clipboard.writeText(l).then(() => msg(L({ en: 'Link copied.', no: 'Lenken er kopiert.' }), 'ok'), () => prompt('', l)); return; }
    if (b.id === 'rshare') { navigator.share({ title: 'Birdbird flow room', text: cur.name, url: location.origin + location.pathname + '#room=' + RM.code }).catch(() => {}); return; }
    if (b.id === 'rsave') { const c = F.clean(JSON.parse(JSON.stringify(cur))); c.id = F.uid(); FL.unshift(c); try { localStorage.setItem(KEY, JSON.stringify(FL)); } catch (x) {} flowSel(); msg(L({ en: 'Saved in My flows.', no: 'Lagret i Mine flows.' }), 'ok'); return; }
    if (b.id === 'frot') { b.disabled = true; rotatePicture(); return; }
    if (b.id === 'fmine' || b.id === 'fcopy') { adoptExample(b.id === 'fcopy'); save(); draw(); panel(); return; } if (b.id === 'pmem') return pStart('draw'); if (b.id === 'pord') return pStart('order'); if (b.id === 'pmshow') { P.memShow = !P.memShow; memDraw(); panel(); return; } if (b.id === 'pgo') return pStart('flow'); if (b.id === 'pex') return pStart('exam'); if (b.id === 'pwk') return pStart('weak'); if (b.id === 'pfc') return pStart('cards'); if (b.id === 'pfa') return pStart('all');
    if (b.id === 'phint') return pHint(); if (b.id === 'pskip') return pNext(true, true); if (b.id === 'pdone') return pNext(true); if (b.id === 'pstop') { pEnd(); return; } if (b.id === 'pcheck') { draw({ notes: true }); $('ov').classList.add('chk'); return; } if (b.id === 'pagain') return pStart(P.exam ? 'exam' : P.kind); });
  $('fstart').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !cur) return;
    if (b.id === 'slib') return window.BBFLOWLIB.browse();
    if (b.id === 'sown') { const f = F.newFlow('img', { roles: cur.rs, name: L({ en: 'My flow', no: 'Min flow' }) }); FL.unshift(f); save(); open(f).then(() => { const i = $('fpanel').querySelector('#fimg'); if (i) i.click(); }); return; }
    if (b.id === 'sphoto') { const ph = A.photos.find(x => x.ac === (A.get(cur.ac) ? cur.ac : (A.photo(cur.ac) || {}).ac)); const f = F.newFlow(ph.id, { roles: cur.rs, name: L({ en: 'My flow', no: 'Min flow' }) + ' · ' + ph.name }); FL.unshift(f); save(); open(f); return; }
    if (b.id === 'sbird') { const f = F.newFlow(cur.ac, { roles: cur.rs, name: L({ en: 'My flow', no: 'Min flow' }) + ' · ' + ((A.get(cur.ac) || A.photo(cur.ac) || {}).name || 'Flow') }); FL.unshift(f); save(); open(f); return; }
    if (b.id === 'swatch') { setMode('watch'); wPlay(); } });
  $('fpq').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.pos != null) return pPick(+b.dataset.pos, false); if (b.dataset.ord != null) return pPick(+b.dataset.ord, true); if (b.id === 'pmundo') { P.taps.pop(); memDraw(); pq(); return; } if (b.id === 'pmchk') return memCheck(); if (b.id === 'phint') return pHint(); if (b.id === 'pskip') return pNext(true, true); if (b.id === 'pdone') return pNext(true); if (b.id === 'pstop') return pEnd(); });
  p.addEventListener('focusin', e => { const li = e.target.closest('.fs'); if (li && mode === 'build' && e.target.classList.contains('ft')) { const id = li.dataset.s; if (sel !== id) { sel = id; draw(); } } }); }
const phEx = () => { const a = cur && (A.get(cur.ac) ? cur.ac : (A.photo(cur.ac) || {}).ac); return A.photos.find(p => p.ac === a && p.id !== cur.ac && F.example(p.id, A)) || null; };
function snapAll() { if (freeBg()) { if (ac && ac.own) cur.steps.forEach(s => { if (!s.tg) return; const m = F.markFind(cur, s.tg); if (m && F.placed(s)) { s.x = m.x; s.y = m.y; } else delete s.tg; }); return; } const a = A.get(cur.ac); cur.steps.forEach(s => { if (s.tg) { const t = A.byId(a, s.tg); if (t) { s.x = Math.round(t.x + t.w / 2); s.y = Math.round(t.y + t.h / 2); } else { s.x = null; s.y = null; delete s.tg; } } }); }
function sopDialog() { const d = $('dsop'); $('soptxt').value = ''; d.showModal(); }

/* ---------- watch ---------- */
const W = { on: false, i: 0, dt: 1.6, role: '', speak: false, t: null, cur: null };
function wList() { return cur.steps.filter(s => !W.role || s.r === W.role); }
function wReset() { wPause(); W.i = 0; W.cur = null; banner(); draw({ upto: 0 }); }
function wPlay() { if (!cur || !cur.steps.length) return; if (W.i >= wList().length) W.i = 0; W.on = true; if ($('stage').clientWidth < 600 && zoom < 1.5) setZoom(2.2); panel(); toStage(); wStep(); }
function wPause() { W.on = false; clearTimeout(W.t); if (window.speechSynthesis) speechSynthesis.cancel(); if (mode === 'watch') panel(); }
function wStep() { if (!W.on) return; const S = wList(); if (W.i >= S.length) { W.on = false; banner(); W.cur = null; draw({ role: W.role || undefined }); panel(); return; }
  const s = S[W.i]; W.cur = s.id; W.i++; const ids = new Set(S.slice(0, W.i).map(x => x.id)); draw({ only: ids, anim: s.id });
  if (s.k === 'call') banner(L({ en: 'Checklist commanded', no: 'Sjekkliste kommandert' }), `${s.r}: ${s.t}`, col(s.r)); else if (s.k === 'event') banner(L({ en: 'Event', no: 'Hendelse' }), s.t, '#9AA5B1'); else banner();
  now(s); const li = $('fpanel').querySelector(`.fs[data-s="${s.id}"]`); $('fpanel').querySelectorAll('.fs.on').forEach(x => x.classList.remove('on')); if (li) { li.classList.add('on'); inPanel(li); }
  if (F.placed(s)) follow(s);
  if (W.speak && window.speechSynthesis && s.t) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s.t.replace(/–/g, ',')); u.lang = 'en-GB'; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) {} }
  W.t = setTimeout(wStep, W.dt * 1000 * (s.k === 'call' ? 1.6 : 1)); }
function now(s) { const n = $('fnow'); if (!s) { n.hidden = true; return; } n.hidden = false; n.style.setProperty('--c', col(s.r)); n.innerHTML = `<span class="fbdg${s.k === 'call' ? ' call' : ''}">${s.k === 'event' ? '⚑' : esc(F.badge(cur, s))}</span><b>${esc(s.r)}</b> ${esc(s.t || '')}${s.n ? `<small>${esc(s.n)}</small>` : ''}`; }
function banner(h, t, c) { const b = $('fban'); if (!h) { b.hidden = true; return; } b.hidden = false; b.style.setProperty('--c', c || '#3CCB7F'); b.innerHTML = `<i>⇆</i><b>${esc(h)}</b><span>${esc(t || '')}</span>`; }
function follow(s) { if (zoom <= 1.05) return; const st = $('stage'), svg = $('cv'), k = svg.clientWidth / 1000; const x = s.x * k - st.clientWidth / 2, y = s.y * k - st.clientHeight / 2; st.scrollTo({ left: x, top: y, behavior: 'smooth' }); }

/* ---------- practise ---------- */
const REV = 'bb-flows-rev', rev = () => { try { return JSON.parse(localStorage.getItem(REV) || '{}') || {}; } catch (e) { return {}; } }, isDue = f => { const o = rev()[f.id]; return !!o && o.due <= Date.now(); };
const P = { on: false, kind: 'flow', role: null, txt: false, auto: true, speak: false, pos: true, q: [], i: 0, tries: 0, hint: 0, log: [], t0: 0, done: new Set(), exam: false };
const STATS = 'bb-flows-stats';
function stats() { try { return JSON.parse(localStorage.getItem(STATS) || '{}') || {}; } catch (e) { return {}; } }
function statAdd(s, miss, hint) { if (!cur || cur.ex || !s || String(s.id).startsWith('T:')) return; try { const S = stats(), f = S[cur.id] || (S[cur.id] = {}), o = f[s.id] || (f[s.id] = { n: 0, m: 0, h: 0 }); o.n++; if (miss) o.m++; if (hint) o.h++; o.t = Date.now(); localStorage.setItem(STATS, JSON.stringify(S)); } catch (e) {} }
function weak() { if (!cur || cur.ex) return []; const f = stats()[cur.id] || {}; return cur.steps.filter(s => s.k === 'act' && F.placed(s) && f[s.id] && (f[s.id].m + f[s.id].h) / f[s.id].n > 0.15).sort((a, b) => { const A1 = f[a.id], B1 = f[b.id]; return (B1.m + B1.h) / B1.n - (A1.m + A1.h) / A1.n; }).slice(0, 10); }
function pStart(kind) { if (!cur) return; stopAll(); P.exam = kind === 'exam'; if (P.exam) kind = 'flow'; P.kind = kind; if (!P.role || (P.role !== '*' && !cur.roles.includes(P.role))) P.role = cur.roles[0]; P.log = []; P.i = 0; P.tries = 0; P.hint = 0; P.done = new Set(); P.t0 = Date.now(); P.ask = null; P.cand = null; $('ov').classList.remove('chk');
  if (kind === 'flow') { const two = cur.roles.length > 1 && P.role !== '*', withP = two && P.auto;
    P.q = cur.steps.filter(s => (P.role === '*' || s.r === P.role || withP) && (F.placed(s) || s.k !== 'act')).map(s => withP && s.r !== P.role ? Object.assign({}, s, { auto: true }) : s); }
  else if (kind === 'draw') { P.q = cur.steps.filter(s => s.k === 'act' && F.placed(s) && (P.role === '*' || s.r === P.role)); P.taps = []; P.mem = null; }
  else if (kind === 'order') { P.q = cur.steps.filter(s => (P.role === '*' || s.r === P.role) && s.t.trim()); if (P.q.length < 3) { msg(L({ en: 'This needs at least three steps with a text.', no: 'Dette krever minst tre steg med tekst.' }), 'err'); return; } }
  else if (kind === 'weak') { P.q = shuffle(weak()); P.kind = 'cards'; }
  else if (kind === 'cards') { const seen = new Set(); P.q = shuffle(cur.steps.filter(s => s.k === 'act' && F.placed(s) && s.t && !seen.has(s.tg || s.t) && seen.add(s.tg || s.t))).slice(0, 20); }
  else P.q = shuffle(A.targets(ac).filter(t => !t.whole || t.k === 's')).slice(0, 20).map(t => ({ id: 'T:' + t.id, r: '', k: 'act', t: t.name + (t.whole ? '' : ' · ' + t.panel), tg: t.id, x: t.x + t.w / 2, y: t.y + t.h / 2 }));
  if (!P.q.length) { msg(L({ en: 'Nothing to practise: place some steps first.', no: 'Ingenting å øve på: plasser noen steg først.' }), 'err'); return; }
  P.on = true; if (kind === 'draw') { memDraw(); panel(); toStage(); return; } draw(kind === 'flow' || kind === 'order' ? { only: P.done } : { hideAll: true }); panel(); toStage(); pAuto(); }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function pq() { const b = $('fpq'); if (!P.on || P.i >= P.q.length) { b.hidden = true; b.innerHTML = ''; return; } b.hidden = false; b.innerHTML = pBox(); }
function pBox() { if (!P.on) return ''; if (P.kind === 'draw') return `<div class="pq"><div class="pc">${P.role === '*' ? L({ en: 'Both roles', no: 'Begge roller' }) : `<b style="color:${col(P.role)}">${P.role}</b>`} · ${P.taps.length} / ${P.q.length}</div><div class="pt">${L({ en: 'Tap the whole flow from memory, in order. No help until you check.', no: 'Trykk hele flowen etter hukommelsen, i rekkefølge. Ingen hjelp før du sjekker.' })}</div><div class="frow"><button class="btn sm" id="pmundo"${P.taps.length ? '' : ' disabled'}>↶ ${L({ en: 'Undo', no: 'Angre' })}</button><button class="btn sm pri" id="pmchk"${P.taps.length ? '' : ' disabled'}>✓ ${L({ en: 'Check', no: 'Sjekk' })}</button><button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div></div>`;
  const s = P.q[P.i]; if (!s) return ''; const n = P.kind === 'flow', role = s.r ? `<b style="color:${col(s.r)}">${s.r}</b> · ` : '';
  if (P.kind === 'order') { if (!P.cand || P.cand.i !== P.i) { const rest = P.q.slice(P.i + 1).map(x => x.t.trim()).filter((t, i, a) => t !== s.t.trim() && a.indexOf(t) === i); P.cand = { i: P.i, wrong: new Set(), o: shuffle(shuffle(rest).slice(0, 4).concat([s.t.trim()])) }; }
    return `<div class="pq"><div class="pc">${role}${P.i + 1} / ${P.q.length}</div><div class="pt">${L({ en: 'Which step comes next?', no: 'Hvilket steg kommer nå?' })}</div><div class="pm">${P.tries ? `<span class="bad">✗ ${P.tries}</span>` : ''}</div><div class="frow fpo">${P.cand.o.map((t, i) => `<button class="btn sm" data-ord="${i}"${P.cand.wrong.has(i) ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div><div class="frow"><button class="btn sm" id="pskip">${L({ en: 'Show and go on', no: 'Vis og gå videre' })}</button><button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div></div>`; }
  if (P.ask) return `<div class="pq"><div class="pc">${role}${esc(F.stateOf(s.t).n)}</div><div class="pt">${L({ en: 'Right control. Which position?', no: 'Riktig bryter. Hvilken posisjon?' })}</div><div class="pm">${P.tries ? `<span class="bad">✗ ${P.tries}</span>` : ''}</div><div class="frow fpo">${P.ask.o.map((t, i) => `<button class="btn sm" data-pos="${i}"${P.ask.wrong.has(i) ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div><div class="frow">${P.exam ? '' : `<button class="btn sm" id="pskip">${L({ en: 'Show and go on', no: 'Vis og gå videre' })}</button>`}<button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div></div>`;
  const shown = x => n && P.pos && !P.live && F.stateOf(x.t).st ? F.stateOf(x.t).n + ' – ?' : (x.t || '…');
  if (s.remote) return `<div class="pq"><div class="pc">${role}${L({ en: 'your partner', no: 'partneren din' })}</div><div class="pt"><span class="hid">${L({ en: `Waiting for ${s.r}…`, no: `Venter på ${s.r} …` })}</span></div></div>`;
  if (s.auto) return `<div class="pq"><div class="pc">${role}${L({ en: 'the other pilot', no: 'den andre piloten' })}</div><div class="pt"><b>${esc(s.t || '…')}</b></div><div class="frow"><button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div></div>`;
  const own = q => !q.auto && !q.remote;
  const cnt = n ? (P.role === '*' ? `${P.i + 1} / ${P.q.length}` : `${L({ en: 'step', no: 'steg' })} ${P.q.slice(0, P.i + 1).filter(x => x.r === s.r && own(x)).length} / ${P.q.filter(x => x.r === s.r && own(x)).length}`) : `${P.i + 1} / ${P.q.length}`;
  const showT = !n || (P.txt && !P.exam) || P.hint >= 1 || s.k !== 'act';
  return `<div class="pq"><div class="pc">${role}${cnt}</div>` +
    (s.k === 'act' ? `<div class="pt">${n ? '' : L({ en: 'Find: ', no: 'Finn: ' })}${showT ? `<b>${esc(shown(s))}</b>` : `<span class="hid">${L({ en: 'Where is the next step?', no: 'Hvor er neste steg?' })}</span>`}</div>` :
      `<div class="pt">${s.k === 'call' ? L({ en: 'Next is a call. Say it, then tap Done.', no: 'Neste er et kall. Si det, og trykk Ferdig.' }) : L({ en: 'Next is an outside event.', no: 'Neste er en hendelse utenfra.' })}${P.hint >= 1 || s.k === 'event' || P.txt ? `<br><b>${esc(s.t)}</b>` : ''}</div>`) +
    `<div class="pm">${P.tries ? `<span class="bad">✗ ${P.tries}</span>` : ''}${s.after && P.role === '*' ? `<small>⏸ ${L({ en: 'after', no: 'etter' })} ${esc(stepName(s.after))}</small>` : ''}</div>` +
    `<div class="frow">${s.k === 'act' && P.exam ? `<button class="btn sm" id="pskip">${L({ en: 'I don’t know', no: 'Vet ikke' })}</button>` : s.k === 'act' ? `<button class="btn sm" id="phint">${P.hint === 0 ? L({ en: 'Hint: show text', no: 'Hint: vis teksten' }) : L({ en: 'Hint: show where', no: 'Hint: vis hvor' })}</button><button class="btn sm" id="pskip">${L({ en: 'Show and go on', no: 'Vis og gå videre' })}</button>` : `<button class="btn sm pri" id="pdone">${L({ en: 'Done', no: 'Ferdig' })}</button><button class="btn sm" id="phint">${L({ en: 'Show it', no: 'Vis det' })}</button>`}<button class="btn sm" id="pstop">${L({ en: 'Stop', no: 'Stopp' })}</button></div></div>`; }
// bring the cockpit to the top of the screen, below whatever sticks to the top of the page (the section menu)
function toStage() { const w = document.querySelector('.fwrap'), r = w.getBoundingClientRect(); let top = 8;
  document.querySelectorAll('header,nav,.snav,[class*="sticky"]').forEach(e => { const cs = getComputedStyle(e); if ((cs.position === 'sticky' || cs.position === 'fixed') && e.getBoundingClientRect().top <= 1) top = Math.max(top, e.getBoundingClientRect().bottom + 6); });
  if (r.top < top - 2 || r.top > innerHeight * 0.35) window.scrollTo({ top: scrollY + r.top - top, behavior: 'smooth' }); }
function pAuto() { const s = P.q[P.i]; if (!P.on || !s || !s.auto || P.live) return; const at = P.i;
  if (s.k === 'call') banner(L({ en: 'Checklist commanded', no: 'Sjekkliste kommandert' }), `${s.r}: ${s.t}`, col(s.r)); else if (s.k === 'event') banner(L({ en: 'Event', no: 'Hendelse' }), s.t, '#9AA5B1');
  if (F.placed(s)) ripple(s.x, s.y, null, 900); say(s.t);
  setTimeout(() => { if (!P.on || P.i !== at) return; banner(); P.done.add(s.id); P.i++; P.tries = 0; P.hint = 0; draw({ only: P.done, anim: s.id }); if (P.i >= P.q.length) pFinish(); panel(); pAuto(); }, s.k === 'act' ? 1300 : 2200); }
function say(t) { if (!P.speak || !t || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).replace(/–/g, ',')); u.lang = 'en-GB'; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) {} }
function pHint() { const s = P.q[P.i]; if (!s) return; P.hint++; if (P.hint >= 2 && F.placed(s)) { ripple(s.x, s.y, null, 1600); setTimeout(() => ripple(s.x, s.y, null, 1600), 350); } panel(); }
function pTap(p) { if (!P.on) return; if (P.kind === 'draw') { if (P.mem) return; P.taps.push({ x: Math.round(p.x), y: Math.round(p.y) }); if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {} if (P.taps.length >= P.q.length) return memCheck(); memDraw(); pq(); return; } const s = P.q[P.i]; if (!s) return; if (s.auto) return; if (P.kind === 'order' || P.ask) { msg(L({ en: 'Choose from the list at the top of the cockpit.', no: 'Velg fra listen øverst på cockpiten.' })); return; } if (s.remote) { msg(L({ en: `Wait for ${s.r}.`, no: `Vent på ${s.r}.` })); return; } if (s.k !== 'act') { msg(L({ en: 'This one is a call: tap Done when you have said it.', no: 'Dette er et kall: trykk Ferdig når du har sagt det.' })); return; }
  const r = F.check(s, p.x, p.y, ac, A, tol()); ripple(p.x, p.y, r.ok); if (P.live) rSend({ t: 'tap', x: Math.round(p.x), y: Math.round(p.y), ok: r.ok });
  if (r.ok) { if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} if (P.kind === 'flow' && P.pos && !P.live && F.stateOf(s.t).st) { P.ask = { o: F.stateChoices(cur, s), wrong: new Set() }; panel(); return; } pNext(false); } else { P.tries++; if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (x) {} if (P.tries >= 3 && P.hint < 2 && !P.exam) { P.hint = 2; ripple(s.x, s.y, null, 1800); } panel(); } }
function pPick(i, ord) { const s = P.q[P.i], c = ord ? P.cand : P.ask; if (!s || !c) return; const right = ord ? c.o[i] === s.t.trim() : c.o[i] === F.stateOf(s.t).st;
  if (right) { if (!ord && !P.exam) msg(s.t, 'ok'); return pNext(false); } c.wrong.add(i); P.tries++; if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (x) {} if (P.exam && !ord) { return pNext(false); } panel(); }
function pNext(manual, reveal) { const s = P.q[P.i]; if (!s || s.auto || s.remote) return; if (reveal && (P.ask || P.kind === 'order')) msg(s.t, 'ok'); P.ask = null; if (P.live) rSend({ t: 'step', id: s.id, tries: P.tries, hint: P.hint }); if (reveal && F.placed(s)) ripple(s.x, s.y, null, 1400); if (s.k === 'act') statAdd(s, P.tries > 0 || reveal, P.hint > 0);
  P.log.push({ r: s.r || '·', ok: !reveal, tries: P.tries, hint: P.hint > 0 }); if (reveal) P.log[P.log.length - 1].ok = false;
  if (P.kind === 'flow' || P.kind === 'order') P.done.add(s.id); P.i++; P.tries = 0; P.hint = 0; draw(P.kind === 'flow' || P.kind === 'order' ? { only: P.done, anim: s.id } : { hideAll: true }); if (s.k === 'call' && P.kind === 'flow') say(s.t); if (P.i >= P.q.length) pFinish(); panel(); pAuto(); }
function pFinish() { const sc = F.score(P.log), tot = P.log.length, first = P.log.filter(x => x.ok && !x.tries && !x.hint).length, pct = Math.round(first / Math.max(1, tot) * 100), sec = Math.round((Date.now() - P.t0) / 1000);
  P.res = { sc, pct, sec, tot, first }; if (P.kind === 'flow' && !cur.ex && !cur.tmp && (P.role === '*' || cur.steps.some(x => x.r === P.role))) { try { const B = JSON.parse(localStorage.getItem(BEST) || '{}'), k = cur.id + ':' + P.role + (P.exam ? ':exam' : ''), o = B[k]; if (!o || pct > o.pct || (pct === o.pct && sec < o.sec)) { B[k] = { pct, sec, at: Date.now() }; localStorage.setItem(BEST, JSON.stringify(B)); P.res.best = true; } } catch (e) {} }
  if (P.kind === 'flow' && !cur.ex && !cur.tmp) { try { const R = rev(); R[cur.id] = F.reviewNext(R[cur.id], pct, Date.now()); localStorage.setItem(REV, JSON.stringify(R)); } catch (e) {} flowSel(); }
  if (P.live) { RM.res[RM.role] = { pct, sec, tot, first }; rSend({ t: 'end', res: { pct, sec, tot, first } }); }
  draw({ notes: true }); }
function pResult() { if (P.kind === 'draw') return memResult(); const r = P.res || {}; return `<div class="pq res"><div class="pt"><b>${r.pct}%</b> ${L({ en: 'right first time', no: 'riktig på første forsøk' })}${r.best ? ` · <span class="okc">${L({ en: 'new best', no: 'ny rekord' })}</span>` : ''}</div>` +
  `<p>${r.first} / ${r.tot} ${L({ en: 'steps without a miss or hint', no: 'steg uten bom eller hint' })} · ${Math.floor(r.sec / 60)}:${String(r.sec % 60).padStart(2, '0')}</p>` +
  `<ul class="fpres">${Object.entries(r.sc || {}).filter(([k]) => k !== '·').map(([k, v]) => `<li style="--c:${col(k)}"><b>${k}</b> ${v.first}/${v.n} ${L({ en: 'first try', no: 'første forsøk' })} · ${v.miss} ${L({ en: 'misses', no: 'bom' })} · ${v.hints} ${L({ en: 'hints', no: 'hint' })}</li>`).join('')}</ul>` +
  `<div class="frow">${P.live ? `<button class="btn pri" id="ragain">↺ ${L({ en: 'Again together', no: 'Igjen sammen' })}</button>` : `<button class="btn pri" id="pagain">↺ ${L({ en: 'Again', no: 'Igjen' })}</button>`}<button class="btn" id="pcheck">${L({ en: 'Check against the flow', no: 'Sammenlign med flowen' })}</button><button class="btn" id="pstop">${L({ en: 'Close', no: 'Lukk' })}</button></div></div>`; }
/* from memory: the learner taps the whole flow with nothing shown, then checks. Each tap is marked: right control in the right
   place in the order (green), right control but out of order (amber, with the number it should have had), or no step there (red);
   steps never tapped get a red ring. Their own path is drawn over the real flow so the difference is plain to see. */
function memCheck() { if (!P.taps.length) return; const Q = P.q, used = new Set();
  const res = P.taps.map((t, i) => { if (Q[i] && F.check(Q[i], t.x, t.y, ac, A, tol()).ok) { used.add(i); return { t, st: 'ok', j: i }; } return { t, st: null, j: -1 }; });
  res.forEach(r => { if (r.st) return; const j = Q.findIndex((q, k) => !used.has(k) && F.check(q, r.t.x, r.t.y, ac, A, tol()).ok); if (j >= 0) { used.add(j); r.st = 'order'; r.j = j; } else r.st = 'miss'; });
  const missing = Q.map((q, k) => k).filter(k => !used.has(k)); Q.forEach((q, k) => statAdd(q, !res.some(r => r.j === k && r.st === 'ok')));
  P.mem = { res, missing, ok: res.filter(r => r.st === 'ok').length, order: res.filter(r => r.st === 'order').length, miss: res.filter(r => r.st === 'miss').length };
  P.memShow = true; P.i = Q.length; P.log = Q.map((q, k) => ({ r: q.r, ok: res.some(r => r.j === k && r.st === 'ok'), tries: 0, hint: false }));
  if (navigator.vibrate) try { navigator.vibrate(P.mem.ok === Q.length ? [20, 60, 20] : 40); } catch (x) {} memDraw(); pq(); panel(); }
function memDraw() { const m = P.mem; if (m && P.memShow) draw({ notes: true, role: P.role === '*' ? undefined : P.role }); else draw({ hideAll: true });
  const T = P.taps || [], out = [], c = P.role && P.role !== '*' ? col(P.role) : '#FFFFFF', k = Math.max(1, cur.style.ls);
  if (T.length > 1) out.push(`<polyline points="${T.map(t => t.x + ',' + t.y).join(' ')}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="${cur.style.lw + 3}" stroke-linejoin="round"/><polyline points="${T.map(t => t.x + ',' + t.y).join(' ')}" fill="none" stroke="${m ? '#FFFFFF' : c}" stroke-width="${Math.max(2, cur.style.lw - 1)}" stroke-dasharray="${m ? '7 6' : '0'}" stroke-linejoin="round"/>`);
  if (m) m.missing.forEach(j => { const q = P.q[j]; out.push(`<circle cx="${q.x}" cy="${q.y}" r="${24 * k}" fill="none" stroke="#FF4D4D" stroke-width="3" stroke-dasharray="6 4"/><text x="${q.x}" y="${q.y - 28 * k}" text-anchor="middle" class="memx">${L({ en: 'missed', no: 'glemt' })}</text>`); });
  T.forEach((t, i) => { const r = m && m.res[i], fc = !r ? c : r.st === 'ok' ? '#3CCB7F' : r.st === 'order' ? '#F2A623' : '#FF4D4D', lab = !r ? i + 1 : r.st === 'ok' ? '✓' : r.st === 'order' ? `${i + 1}→${r.j + 1}` : '✗';
    out.push(`<g transform="translate(${t.x} ${t.y})"><circle r="${11 * k}" fill="${fc}" stroke="#0B0F12" stroke-width="2.5"/><text y="${4 * k}" text-anchor="middle" class="memn" style="font-size:${(String(lab).length > 2 ? 8 : 12) * k}px">${lab}</text></g>`); });
  $('ov').insertAdjacentHTML('beforeend', `<g class="mem">${out.join('')}</g>`); }
function memResult() { const m = P.mem || { ok: 0, order: 0, miss: 0, missing: [] }, n = P.q.length, pct = Math.round(m.ok / Math.max(1, n) * 100);
  const sw = m.res ? m.res.filter(r => r.st === 'order').map((r, i) => `<li><b>${m.res.indexOf(r) + 1}</b> → ${esc(P.q[r.j].t || '')} <small>(${L({ en: 'step', no: 'steg' })} ${r.j + 1})</small></li>`) : [];
  return `<div class="pq res"><div class="pt"><b>${pct}%</b> ${L({ en: 'in the right place and order', no: 'på rett sted og i rett rekkefølge' })}</div>` +
    `<ul class="fpres mem"><li style="--c:#3CCB7F">✓ ${m.ok} ${L({ en: 'right', no: 'riktige' })}</li><li style="--c:#F2A623">⇄ ${m.order} ${L({ en: 'right control, wrong order', no: 'riktig bryter, feil rekkefølge' })}</li><li style="--c:#FF4D4D">✗ ${m.miss} ${L({ en: 'no step there', no: 'ikke et steg der' })} · ${m.missing.length} ${L({ en: 'missed', no: 'glemt' })}</li></ul>` +
    (sw.length ? `<p class="fex">${L({ en: 'Out of order', no: 'Feil rekkefølge' })}:</p><ol class="memsw">${sw.join('')}</ol>` : '') +
    (m.missing.length ? `<p class="fex">${L({ en: 'Missed', no: 'Glemt' })}: ${m.missing.map(j => esc(P.q[j].t || L({ en: 'step', no: 'steg' }) + ' ' + (j + 1))).join(', ')}</p>` : '') +
    `<div class="frow"><button class="btn pri" id="pagain">↺ ${L({ en: 'Again', no: 'Igjen' })}</button><button class="btn" id="pmshow">${P.memShow ? L({ en: 'Hide the real flow', no: 'Skjul den riktige flowen' }) : L({ en: 'Show the real flow', no: 'Vis den riktige flowen' })}</button><button class="btn" id="pstop">${L({ en: 'Close', no: 'Lukk' })}</button></div></div>`; }
function pEnd() { P.on = false; P.res = null; pq(); $('ov').classList.remove('chk'); draw(mode === 'practise' ? { hideAll: true } : {}); panel(); }
function revTxt() { if (!cur || cur.ex) return ''; const o = rev()[cur.id]; if (!o) return ''; const d = Math.ceil((o.due - Date.now()) / 864e5);
  return `<p class="fex">${d <= 0 ? '● ' + L({ en: 'Due for review today.', no: 'Klar for repetisjon i dag.' }) : L({ en: `Next review in ${d} ${d === 1 ? 'day' : 'days'}.`, no: `Neste repetisjon om ${d} ${d === 1 ? 'dag' : 'dager'}.` })}</p>`; }
function bestTxt() { if (!cur || cur.ex) return ''; let B = {}; try { B = JSON.parse(localStorage.getItem(BEST) || '{}'); } catch (e) {} const rows = cur.roles.concat(cur.roles.length > 1 ? ['*'] : []).map(r => [r, B[cur.id + ':' + r]]).filter(x => x[1]);
  const ex = cur.roles.map(r => [r, B[cur.id + ':' + r + ':exam']]).filter(x => x[1]); rows.push(...ex.map(([r, o]) => [r + ' ' + L({ en: 'check ride', no: 'sjekkflyging' }), o]));
  return rows.length ? `<p class="fbest">${L({ en: 'Best', no: 'Beste' })}: ${rows.map(([r, o]) => `${r === '*' ? L({ en: 'both', no: 'begge' }) : r} ${o.pct}% (${Math.floor(o.sec / 60)}:${String(o.sec % 60).padStart(2, '0')})`).join(' · ')}</p>` : ''; }

/* ---------- together: a live room for two pilots (functions/api/room.js) ----------
   The host shares the flow (never a photo); the partner gets it as a temporary flow. Practice runs in flow order across both
   roles: your steps you find, your partner's steps you watch happen (their taps show as rings in their colour). */
const RM = { code: null, me: null, host: false, name: '', role: null, members: [], seq: 0, t: null, busy: false, live: false, res: {}, err: '', mine: null, lastSeen: 0 };
try { RM.name = localStorage.getItem('bb-flows-name') || ''; } catch (e) {}
async function api(o) { const r = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) }); const j = await r.json().catch(() => ({ ok: false, message: 'No answer from the server.' })); if (!j.ok) throw new Error(j.message || j.error || 'Error'); return j; }
async function rOpen() { const name = ($('rname') || {}).value || RM.name || 'Pilot', role = ($('rrole') || {}).value || cur.roles[0]; rName(name);
  const o = JSON.parse(JSON.stringify(cur)); delete o.ex; if (o.img) o.img = { w: o.img.w, h: o.img.h, name: o.img.name, id: '' };
  try { RM.busy = true; panel(); const j = await api({ op: 'create', flow: o, name, role }); Object.assign(RM, { code: j.code, me: j.me, host: true, role, seq: 0, members: [{ id: j.me.slice(0, 8), name, role, on: true }], live: false, res: {}, err: '' }); RM.mine = cur; rStore(); rPoll(); }
  catch (e) { RM.err = e.message; } RM.busy = false; panel(); }
async function rJoin(code, me) { const name = ($('rname') || {}).value || RM.name || 'Pilot'; let role = ($('rrole') || {}).value || null; rName(name);
  try { RM.busy = true; RM.err = ''; panel(); const j = await api({ op: 'join', code, name, role: role || 'PM', me }); const f = F.clean(j.flow); f.tmp = true; f.id = 'room-' + j.code;
    Object.assign(RM, { code: j.code, me: j.me, host: false, seq: j.seq, members: j.members, live: false, res: {}, err: '' });
    // take the role you picked if it is free, otherwise the free one (two pilots, two roles)
    const taken = j.members.filter(m => m.id !== j.me.slice(0, 8) && m.on).map(m => m.role), want = role;
    if (!role || !f.roles.includes(role) || taken.includes(role)) role = f.roles.find(r => !taken.includes(r)) || f.roles[0];
    if (role !== want || !want) { await api({ op: 'send', code: j.code, me: j.me, ev: { t: 'role', role } }); j.members.forEach(m => { if (m.id === j.me.slice(0, 8)) m.role = role; }); RM.members = j.members; }
    RM.role = role; rStore(); RM.mine = null; await open(f); setMode('together'); rPoll(); await rSend({ t: 'hello', name, role }); }
  catch (e) { RM.err = e.message; } RM.busy = false; panel(); }
function rName(n) { RM.name = String(n || '').trim().slice(0, 24); try { localStorage.setItem('bb-flows-name', RM.name); } catch (e) {} }
function rStore() { try { sessionStorage.setItem('bb-flows-room', JSON.stringify({ code: RM.code, me: RM.me, host: RM.host, role: RM.role })); } catch (e) {} }
async function rLeave() { const c = RM.code, me = RM.me; clearTimeout(RM.t); Object.assign(RM, { code: null, me: null, live: false, members: [], res: {} }); try { sessionStorage.removeItem('bb-flows-room'); } catch (e) {} P.on = false; P.live = false; pq();
  if (c) api({ op: 'leave', code: c, me }).catch(() => {}); if (cur && cur.tmp) await open(FL[0] || F.example('a320', A)); panel(); }
async function rSend(ev) { if (!RM.code) return; try { await api({ op: 'send', code: RM.code, me: RM.me, ev }); } catch (e) { if (/not in this room|no room/i.test(e.message)) { RM.err = e.message; rLeave(); } } }
async function rPoll() { clearTimeout(RM.t); if (!RM.code) return;
  if (document.hidden) { RM.t = setTimeout(rPoll, 3000); return; }
  try { const r = await fetch(`/api/room?c=${encodeURIComponent(RM.code)}&me=${encodeURIComponent(RM.me)}&since=${RM.seq}`); const j = await r.json();
    if (!j.ok) { if (r.status === 403 || r.status === 404) { RM.err = j.message; rLeave(); return; } throw new Error(j.message); }
    const before = JSON.stringify(RM.members); RM.members = j.members; RM.seq = Math.max(RM.seq, j.seq); j.ev.forEach(rOn);
    if (JSON.stringify(RM.members) !== before && mode === 'together') panel(); }
  catch (e) {}
  const partner = RM.members.some(m => m.id !== RM.me.slice(0, 8) && m.on);
  RM.t = setTimeout(rPoll, RM.live ? 900 : partner ? 2500 : 2000); }
function rOn(e) { const who = RM.members.find(m => m.id === e.from), rl = (who && who.role) || e.role;
  if (e.t === 'hello' || e.t === 'role') { if (mode === 'together') panel(); return; }
  if (e.t === 'start') { rStart(false); return; }
  if (e.t === 'reset') { P.on = false; P.live = false; RM.live = false; pq(); draw(); panel(); return; }
  if (e.t === 'tap' && P.live) { ringFor(e.x, e.y, rl, e.ok); return; }
  if (e.t === 'step' && P.live) { const i = P.q.findIndex((x, k) => k >= P.i && x.id === e.id); if (i < 0) return;
    for (let k = P.i; k <= i; k++) P.done.add(P.q[k].id); const s = P.q[i]; P.i = i + 1; P.tries = 0; P.hint = 0;
    if (s.k === 'call') { banner(L({ en: 'Checklist commanded', no: 'Sjekkliste kommandert' }), `${s.r}: ${s.t}`, col(s.r)); say(s.t); setTimeout(() => banner(), 2600); }
    draw({ only: P.done, anim: s.id }); if (P.i >= P.q.length) pFinish(); panel(); return; }
  if (e.t === 'end') { RM.res[rl || '?'] = e.res; if (mode === 'together') panel(); } }
function ringFor(x, y, r, ok) { const g = $('fx'), c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 10); c.setAttribute('class', 'rip'); c.style.stroke = ok === false ? '#FF5A5A' : col(r); c.style.strokeDasharray = '6 4'; g.appendChild(c); setTimeout(() => c.remove(), 1100); }
function rStart(mine) { if (mode !== 'together') setMode('together'); if (mine) rSend({ t: 'start', at: Date.now() }); RM.live = true; RM.res = {}; stopAll(); P.exam = false; P.kind = 'flow'; P.role = RM.role; P.log = []; P.i = 0; P.tries = 0; P.hint = 0; P.done = new Set(); P.t0 = Date.now(); P.live = true;
  P.q = cur.steps.filter(s => F.placed(s) || s.k !== 'act').map(s => s.r !== RM.role ? Object.assign({}, s, { remote: true }) : s);
  P.on = true; mode = 'together'; draw({ only: P.done }); panel(); toStage(); clearTimeout(RM.t); rPoll(); }
function roomCard() { const meId = RM.me.slice(0, 8), mine = RM.members.find(m => m.id === meId) || { name: RM.name, role: RM.role, on: true }, other = RM.members.filter(m => m.id !== meId);
  const av = (m, you) => `<div class="rav${m.on ? ' on' : ''}" style="--c:${col(m.role)}"><i>${esc((m.name || '?').slice(0, 1).toUpperCase())}</i><b>${esc(m.name)}${you ? ` <small>(${L({ en: 'you', no: 'deg' })})</small>` : ''}</b><span>${esc(m.role)}</span></div>`;
  const ready = other.some(m => m.on), link = location.origin + location.pathname + '#room=' + RM.code;
  const res = Object.keys(RM.res).length ? `<ul class="fpres">${Object.entries(RM.res).map(([r, v]) => `<li style="--c:${col(r)}"><b>${esc(r)}</b> ${v.pct}% ${L({ en: 'first try', no: 'første forsøk' })} · ${v.first}/${v.tot} · ${Math.floor(v.sec / 60)}:${String(v.sec % 60).padStart(2, '0')}</li>`).join('')}</ul>` : '';
  return `<div class="room"><h3>${L({ en: RM.host ? 'Your room' : 'Room', no: RM.host ? 'Rommet ditt' : 'Rom' })}</h3><div class="ravs">${av(mine, true)}<span class="rline${ready ? ' on' : ''}"></span>${other.length ? other.map(m => av(m)).join('') : `<div class="rav wait"><i>?</i><b>${L({ en: 'Waiting…', no: 'Venter …' })}</b><span>${esc(cur.roles.find(r => r !== RM.role) || '')}</span></div>`}</div>` +
    `<p class="rst${ready ? ' ok' : ''}">${ready ? (RM.live ? L({ en: 'Live: both pilots connected', no: 'Direkte: begge pilotene er koblet til' }) : L({ en: 'Both pilots connected: ready', no: 'Begge pilotene er koblet til: klare' })) : L({ en: 'Waiting for your partner…', no: 'Venter på partneren din …' })}</p>` +
    `<label class="rcode">${L({ en: 'Room code', no: 'Romkode' })}<span><code>${esc(RM.code)}</code><button class="btn sm" id="rcopy">${L({ en: 'Copy link', no: 'Kopier lenke' })}</button>${navigator.share ? `<button class="btn sm" id="rshare">${L({ en: 'Share', no: 'Del' })}</button>` : ''}</span></label>` +
    `<p class="note">${L({ en: 'Your partner opens the link, or Birdbird → Flow trainer → Together and types the code. No account needed.', no: 'Partneren åpner lenken, eller Birdbird → Flow-trener → Sammen og skriver koden. Ingen konto trengs.' })}</p>` +
    (cur.ac === 'img' ? `<p class="fex">${L({ en: 'This flow is drawn on a photo, and photos are never shared: your partner adds their own picture of the same cockpit, or you both use a Birdbird cockpit.', no: 'Flowen er tegnet på et bilde, og bilder deles aldri: partneren legger til sitt eget bilde av samme cockpit, eller dere bruker begge en Birdbird-cockpit.' })}</p>` : '') + res +
    `<div class="frow">${RM.live ? `<button class="btn" id="rreset">↺ ${L({ en: 'Restart', no: 'Start på nytt' })}</button>` : `<button class="btn pri" id="rstart"${ready ? '' : ' disabled'}>▶ ${L({ en: 'Start the flow together', no: 'Start flowen sammen' })}</button>`}<button class="btn warn" id="rleave">${L({ en: 'Leave', no: 'Forlat' })}</button>${cur.tmp ? `<button class="btn" id="rsave">${L({ en: 'Save a copy', no: 'Lagre en kopi' })}</button>` : ''}</div>` +
    `<p class="note">${L({ en: 'In flow order: you find your own steps; your partner’s taps show as dashed rings in their colour, and their checklist calls appear on your screen.', no: 'I flow-rekkefølge: du finner dine egne steg; partnerens trykk vises som stiplede ringer i deres farge, og sjekklistekallene deres kommer opp på skjermen din.' })}</p></div>`; }
function roomForm() { const h = (location.hash.match(/room=([\w-]+)/) || [])[1] || '';
  return `<p>${L({ en: 'Practise with a partner on another phone, tablet or computer: one PF and one PM, in real time. No account needed.', no: 'Øv sammen med en partner på en annen telefon, nettbrett eller PC: én PF og én PM, i sanntid. Ingen konto trengs.' })}</p>` +
    `<div class="frow"><label class="grow">${L({ en: 'Your name', no: 'Navnet ditt' })}<input id="rname" maxlength="24" value="${esc(RM.name)}" placeholder="${esc(L({ en: 'e.g. Goose', no: 'f.eks. Goose' }))}"></label><label>${L({ en: 'Your role', no: 'Rollen din' })}<select id="rrole">${cur.roles.map(r => `<option>${r}</option>`).join('')}</select></label></div>` +
    (cur.roles.length < 2 ? `<p class="fex">${L({ en: 'This flow has one pilot. A room is for flows with two roles: change Roles to PF / PM under Build.', no: 'Denne flowen har én pilot. Et rom er for flows med to roller: endre Roller til PF / PM under Bygg.' })}</p>` : `<div class="frow"><button class="btn pri" id="ropen"${RM.busy || cur.tmp ? ' disabled' : ''}>${L({ en: 'Open a room with this flow', no: 'Åpne et rom med denne flowen' })}</button></div>`) +
    `<h3 style="margin:16px 0 6px">${L({ en: 'Join a room', no: 'Bli med i et rom' })}</h3><div class="frow"><label class="grow">${L({ en: 'Room code or link', no: 'Romkode eller lenke' })}<input id="rjc" value="${esc(h)}" placeholder="oscar-beacon-6209" autocapitalize="none" autocomplete="off"></label><button class="btn pri" id="rjoin"${RM.busy ? ' disabled' : ''}>${L({ en: 'Join', no: 'Bli med' })}</button></div>` +
    (RM.err ? `<p class="fmsg err">${esc(RM.err)}</p>` : ''); }

/* ---------- modes ---------- */
function stopAll() { wPause(); P.on = false; P.res = null; pq(); banner(); now(); $('ov').classList.remove('chk'); }
function setMode(m) { if (P.live && m !== 'together') { P.live = false; RM.live = false; } stopAll(); mode = m; document.querySelectorAll('#fguide li[data-m]').forEach(li => li.classList.toggle('on', li.dataset.m === m)); document.querySelectorAll('.fmode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === m))); $('app').dataset.mode = m;
  if (m === 'watch') { W.i = 0; draw({ upto: 0 }); } else if (m === 'practise') draw({ hideAll: true }); else draw(); panel(); }
const RMX = { RM, rJoin };

/* ---------- files, links, picture export ---------- */
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const fileName = (ext) => (cur.name || 'flow').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) + ext;
async function exportFile() { const o = JSON.parse(JSON.stringify(cur)); delete o.ex; if (cur.ac === 'img' && cur.img && cur.img.id) { try { const r = await imgGet(cur.img.id); if (r && r.blob) o.imgData = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(r.blob); }); } catch (e) {} }
  download(fileName('.bbflow.json'), new Blob([JSON.stringify({ birdbird: 'flow', v: 1, flow: o })], { type: 'application/json' })); }
async function importFile(file) { try { const j = JSON.parse(await file.text()), o = j && (j.flow || j); const f = F.clean(o); if (!f) throw new Error('not a flow');
  if (o.imgData && /^data:image\/(jpeg|png|webp);base64,/.test(o.imgData)) { const blob = await (await fetch(o.imgData)).blob(); const id = 'img-' + F.uid(); await imgPut({ id, blob, w: f.img ? f.img.w : 1000, h: f.img ? f.img.h : 750, name: f.img ? f.img.name : 'cockpit', at: Date.now() }); f.img = Object.assign({}, f.img || {}, { id }); }
  if (FL.some(x => x.id === f.id)) f.id = F.uid(); FL.unshift(f); save(); await open(f); msg(L({ en: 'Flow imported.', no: 'Flowen er importert.' }), 'ok'); }
  catch (e) { msg(L({ en: 'That is not a Birdbird flow file.', no: 'Det er ikke en Birdbird-flowfil.' }), 'err'); } }
async function share() { const url = location.origin + location.pathname + '#f=' + F.encode(cur), txt = cur.name + ' · Birdbird';
  if (url.length > 60000) { msg(L({ en: 'This flow is too large for a link: use Save as file.', no: 'Flowen er for stor for en lenke: bruk Lagre som fil.' }), 'err'); return; }
  try { if (navigator.share && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) { await navigator.share({ title: txt, url }); return; } await navigator.clipboard.writeText(url); msg(L({ en: 'Link copied. Photos are not in the link: the other pilot adds their own.', no: 'Lenken er kopiert. Bilder er ikke med i lenken: den andre piloten legger til sitt eget.' }), 'ok'); }
  catch (e) { prompt(L({ en: 'Copy the link', no: 'Kopier lenken' }), url); } }
const bgFile = () => PH() ? PH().file : ac && ac.img ? ac.img.hi : '';
async function phData(x) { try { const b = await (await fetch(bgFile())).blob(); const d = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); return x.replace(/href="[^"]+"/, () => `href="${d}"`); } catch (e) { return x; } }
async function png() { const svg = $('cv'), Hh = H(), sc = 2; draw(mode === 'practise' ? {} : { notes: true });
  let bgx = $('bg').innerHTML; if (bgFile()) bgx = await phData(bgx); else if (cur.ac === 'img' && imgURL) { const r = await imgGet(cur.img.id); const d = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(r.blob); }); bgx = `<image href="${d}" x="0" y="0" width="1000" height="${Hh}" preserveAspectRatio="none"/>`; }
  const legend = cur.roles.map((r, i) => `<circle cx="${30 + i * 120}" cy="${Hh + 30}" r="9" fill="${col(r)}"/><text x="${46 + i * 120}" y="${Hh + 35}" font-family="sans-serif" font-size="15" fill="#fff">${r}</text>`).join('') + `<text x="980" y="${Hh + 35}" text-anchor="end" font-family="sans-serif" font-size="14" fill="#9AA5B1">${esc(cur.name)} · birdbird.eu</text>`;
  const css = '.fz{font:700 11px sans-serif;fill:#9AA5B1;letter-spacing:.08em}.pbl{font-family:monospace;font-weight:800}.phc{font:600 12px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px;opacity:.85}.fpn{font:700 11px sans-serif;fill:#D7DCE1}.fpn.scr{fill:#7FD1A0}.ftn{font-family:sans-serif;fill:#E9ECEF}.bn{font:800 15px sans-serif;fill:#0B0F12}.bl{font:700 13px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px}.nt{font:600 12px sans-serif;fill:#3B3000}';
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${Hh + 60}" width="${1000 * sc}" height="${(Hh + 60) * sc}"><style>${css}</style><rect width="1000" height="${Hh + 60}" fill="#14181C"/>${bgx}${$('ov').innerHTML}${legend}</svg>`;
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 1000 * sc; c.height = (Hh + 60) * sc; c.getContext('2d').drawImage(img, 0, 0); c.toBlob(b => download(fileName('.png'), b), 'image/png'); };
  img.onerror = () => msg(L({ en: 'Could not make the picture.', no: 'Kunne ikke lage bildet.' }), 'err'); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); if (mode === 'watch') draw({ upto: W.i }); }

/* ---------- video: the flow drawn step by step, recorded from a canvas (MP4 where the browser can, else WebM) ---------- */
async function video() { if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { msg(L({ en: 'This browser cannot record video. Try Chrome, Edge or Safari.', no: 'Denne nettleseren kan ikke ta opp video. Prøv Chrome, Edge eller Safari.' }), 'err'); return; }
  const S = cur.steps.filter(x => !hidden[x.r]); if (!S.length) return; const Hh = H(), k = 1.08, top = 120, bot = 150, Wd = Math.round(1000 * k), Ht = Math.round(Hh * k) + top + bot;
  let bgs = $('bg').innerHTML; if (bgFile()) bgs = await phData(bgs); else if (cur.ac === 'img' && cur.img && cur.img.id) { const r = await imgGet(cur.img.id); if (r && r.blob) { const d = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(r.blob); }); bgs = `<image href="${d}" x="0" y="0" width="1000" height="${Hh}" preserveAspectRatio="none"/>`; } }
  const css = '.fz{font:700 11px sans-serif;fill:#9AA5B1;letter-spacing:.08em}.phc{font:600 12px sans-serif;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px;opacity:.85}.fpn{font:700 11px sans-serif;fill:#D7DCE1}.fpn.scr{fill:#7FD1A0}.ftn{font-family:sans-serif;fill:#E9ECEF}.nophoto{font:600 26px sans-serif;fill:#9AA5B1}';
  const bgImg = await new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${Hh}" width="${Wd}" height="${Math.round(Hh * k)}"><style>${css}</style>${bgs}</svg>`); });
  const c = document.createElement('canvas'); c.width = Wd; c.height = Ht; const x = c.getContext('2d'), X = v => v * k, Y = v => top + v * k;
  const quad = (a, b) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L0 = Math.hypot(dx, dy) || 1, kk = Math.min(40, L0 * 0.12); return { cx: mx - dy / L0 * kk, cy: my + dx / L0 * kk, L0 }; };
  const qp = (a, b, q, t) => [(1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * q.cx + t * t * b.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * q.cy + t * t * b.y];
  function line(a, b, col, prog) { const q = quad(a, b), r = 15 * cur.style.ls, t0 = Math.min(.45, r / q.L0), t1 = t0 + (Math.max(.55, 1 - (r + 4) / q.L0) - t0) * prog, n = 24;
    x.lineCap = 'round'; [[ 'rgba(0,0,0,.45)', cur.style.lw + 3 ], [col, cur.style.lw]].forEach(([cc, w]) => { x.strokeStyle = cc; x.lineWidth = w * k; x.beginPath(); for (let i = 0; i <= n; i++) { const p = qp(a, b, q, t0 + (t1 - t0) * i / n); i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])); } x.stroke(); });
    if (prog > .98) { const p1 = qp(a, b, q, t1), p0 = qp(a, b, q, t1 - .03), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), s = 9 * k * Math.max(1, cur.style.lw / 3); x.fillStyle = col; x.beginPath(); x.moveTo(X(p1[0]) + Math.cos(ang) * s, Y(p1[1]) + Math.sin(ang) * s); x.lineTo(X(p1[0]) + Math.cos(ang + 2.5) * s, Y(p1[1]) + Math.sin(ang + 2.5) * s); x.lineTo(X(p1[0]) + Math.cos(ang - 2.5) * s, Y(p1[1]) + Math.sin(ang - 2.5) * s); x.fill(); } }
  function badge(s, sc) { const R = 15 * cur.style.ls * k * sc, cx = X(s.x), cy = Y(s.y); x.fillStyle = col(s.r); x.strokeStyle = '#0B0F12'; x.lineWidth = 2.5 * k; x.beginPath(); if (s.k === 'call') x.rect(cx - R, cy - R, 2 * R, 2 * R); else x.arc(cx, cy, R, 0, 7); x.fill(); x.stroke();
    const b = s.k === 'call' ? '✓' : F.badge(cur, s); x.fillStyle = '#0B0F12'; x.font = `800 ${Math.round((b.length > 2 ? 11 : 15) * cur.style.ls * k * sc)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b, cx, cy + 1); }
  function text(t, px, y0, colr, w, bold) { x.fillStyle = colr; x.font = `${bold ? 800 : 600} ${px}px sans-serif`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; const words = String(t).split(' '); let line0 = '', y = y0; for (const wd of words) { if (x.measureText(line0 + wd).width > w && line0) { x.fillText(line0, 40, y); line0 = ''; y += px * 1.25; } line0 += wd + ' '; } x.fillText(line0, 40, y); }
  function frame(i, t) { x.fillStyle = '#0E1114'; x.fillRect(0, 0, Wd, Ht); x.drawImage(bgImg, 0, top);
    text(cur.name, 38, 58, '#fff', Wd - 80, true); text(cur.roles.map(r => r).join(' · ') + ' · birdbird.eu', 22, 94, '#9AA5B1', Wd - 80);
    const shown = S.slice(0, i + 1).filter(F.placed); cur.roles.forEach(r => { const R = shown.filter(s => s.r === r); for (let j = 1; j < R.length; j++) line(R[j - 1], R[j], col(r), R[j] === S[i] && F.placed(S[i]) ? Math.min(1, t / .6) : 1); });
    shown.forEach(s => badge(s, s === S[i] ? Math.min(1, Math.max(0, (t - .45) / .25)) : 1));
    const s = S[i]; if (s) { x.fillStyle = col(s.r); x.fillRect(0, Ht - bot, 10, bot); text((s.k === 'call' ? '☑ ' : s.k === 'event' ? '⚑ ' : F.badge(cur, s) + '  ') + s.r, 26, Ht - bot + 48, col(s.r), Wd - 80, true); text(s.t || '', 34, Ht - bot + 96, '#fff', Wd - 80, true); } }
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)); if (!type) { msg(L({ en: 'This browser cannot record video.', no: 'Denne nettleseren kan ikke ta opp video.' }), 'err'); return; }
  const st = c.captureStream(30), rec = new MediaRecorder(st, { mimeType: type, videoBitsPerSecond: 6e6 }), parts = []; rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  const done = new Promise(ok => rec.onstop = ok); rec.start(500); const per = s => s.k === 'act' ? 1.1 : 2.2, total = S.reduce((a, s) => a + per(s), 0) + 1.5; let t0 = performance.now();
  await new Promise(ok => { const tick = () => { const el = (performance.now() - t0) / 1000; let acc = 0, i = 0; for (; i < S.length; i++) { if (el < acc + per(S[i])) break; acc += per(S[i]); }
    frame(Math.min(i, S.length - 1), i < S.length ? (el - acc) / per(S[i]) * (S[i].k === 'act' ? 1 : 2) : 1); msg(L({ en: `Recording the video… ${Math.max(0, Math.ceil(total - el))} s`, no: `Tar opp videoen … ${Math.max(0, Math.ceil(total - el))} s` }));
    if (el >= total) ok(); else requestAnimationFrame(tick); }; tick(); });
  rec.stop(); await done; download(fileName(type.includes('mp4') ? '.mp4' : '.webm'), new Blob(parts, { type: type.split(';')[0] })); msg(L({ en: 'Video saved.', no: 'Videoen er lagret.' }), 'ok'); }

/* ---------- new flow ---------- */
/* the Birdbird cockpits as <optgroup>s: airliners, turboprops, training aircraft; the same list and order everywhere */
function acOpts(sel) { return A.groups.map(g => g.list.length ? `<optgroup label="${esc(L(g))}">` + g.list.map(a => `<option value="${a.id}"${sel === a.id ? ' selected' : ''}>${esc(a.name)}${a.img ? '' : ' · ' + esc(L({ en: 'drawing', no: 'tegning' }))}</option>`).join('') + '</optgroup>' : '').join(''); }
function newDialog() { const d = $('dnew'); $('nname').value = ''; $('nac').innerHTML = `<option value="img">${esc(L({ en: 'My own cockpit photo or PDF', no: 'Mitt eget cockpitbilde eller PDF' }))}</option>` + acOpts('') + `<optgroup label="${esc(L({ en: 'Real photos (free licence)', no: 'Ekte foto (fri lisens)' }))}">` + A.photos.map(a => `<option value="${a.id}">${esc(a.name)} · ${esc(L({ en: 'real photo', no: 'ekte foto' }))}</option>`).join('') + '</optgroup>';
  $('nrs').value = 'pfpm'; d.showModal(); }
async function createFlow() { const acv = $('nac').value, a = A.get(acv), f = F.newFlow(acv, { roles: $('nrs').value, name: $('nname').value.trim() || (a ? a.name : L({ en: 'My flow', no: 'Min flow' })) });
  FL.unshift(f); save(); mode = 'build'; await open(f); if (acv === 'img') { const i = $('fpanel').querySelector('#fimg'); if (i) i.click(); } }

/* ---------- start ---------- */
function init() { load(); wirePanel();
  const svg = $('cv'); svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', () => { drag = null; }); svg.addEventListener('click', onClick);
  $('stage').addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = $('stage').getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  { const G = $('fguide'); let seen = 0; try { seen = +localStorage.getItem('bb-flows-guide'); } catch (e) {} G.hidden = !!seen;
    G.addEventListener('click', e => { if (e.target.closest('#fgok')) { G.hidden = true; try { localStorage.setItem('bb-flows-guide', '1'); } catch (x) {} return; } const li = e.target.closest('li[data-m]'); if (li) setMode(li.dataset.m); }); }
  $('zin').onclick = () => setZoom(zoom * 1.4); $('zout').onclick = () => setZoom(zoom / 1.4); $('zfit').onclick = fit; $('zfull').onclick = () => focusMode();
  pinch(); stickTop(); addEventListener('resize', stickTop, { passive: true }); addEventListener('orientationchange', () => setTimeout(stickTop, 300));
  document.querySelectorAll('.fmode button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $('fsel').onchange = e => { const v = e.target.value; if (v.startsWith('ex:')) open(F.example(v.slice(3), A)); else open(FL.find(f => f.id === v)); };
  $('fnew').onclick = newDialog; $('dnew').addEventListener('close', () => { if ($('dnew').returnValue === 'ok') createFlow(); });
  $('dsop').addEventListener('close', () => { if ($('dsop').returnValue !== 'ok' || !cur) return; const S = F.parseSop($('soptxt').value); if (!S.length) return; if (cur.ex) adoptExample();
    S.forEach(x => F.addStep(cur, { r: role, t: x.t, k: x.k, x: null, y: null })); save(); draw(); panel(); msg(L({ en: `${S.length} steps added. Tap the cockpit to place them one by one.`, no: `${S.length} steg lagt til. Trykk i cockpiten for å plassere dem ett for ett.` }), 'ok'); });
  $('fmenu').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b || !cur) return; $('fmenu').closest('details').open = false; const a = b.dataset.a;
    if (a === 'lib') return window.BBFLOWLIB.browse(); if (a === 'pub') return window.BBFLOWLIB.publish();
    if (a === 'share') return share(); if (a === 'file') return exportFile(); if (a === 'png') return png(); if (a === 'video') return video(); if (a === 'print') { window.print(); return; }
    if (a === 'import') return $('fimp').click();
    if (a === 'clear') { if (cur.ex) { adoptExample(); save(); draw(); panel(); return; } if (!cur.steps.length || !confirm(L({ en: `Remove all ${cur.steps.length} steps from “${cur.name}”?`, no: `Fjerne alle ${cur.steps.length} stegene fra «${cur.name}»?` }))) return; snap(); cur.steps = []; save(); draw(); panel(); msg(L({ en: 'All steps removed. Undo brings them back.', no: 'Alle steg er fjernet. Angre henter dem tilbake.' })); return; }
    if (a === 'dup') { const c = F.clean(JSON.parse(JSON.stringify(cur))); c.id = F.uid(); c.name = (cur.name + ' (2)').slice(0, 80); FL.unshift(c); save(); return open(c); }
    if (a === 'del') { if (cur.ex) return; if (!confirm(L({ en: `Delete “${cur.name}”? This cannot be undone.`, no: `Slette «${cur.name}»? Dette kan ikke angres.` }))) return; const im = cur.img && cur.img.id; FL = FL.filter(f => f !== cur); if (im && !FL.some(f => f.img && f.img.id === im)) imgDel(im).catch(() => {}); try { localStorage.setItem(KEY, JSON.stringify(FL)); } catch (x) {} return open(FL[0] || F.example('a320', A)); } });
  // a picture or PDF dropped on the page or pasted: the cockpit picture of a flow on your own picture (the first one, or one more below)
  const takeFile = fl => { if (!fl || !cur || mode !== 'build') return; if (!/^image\/|pdf$/i.test(fl.type) && !/\.(pdf|png|jpe?g|webp|heic)$/i.test(fl.name || '')) return;
    if (cur.ac !== 'img') { msg(L({ en: 'To use your own picture, choose "My own photo or PDF" under Cockpit first.', no: 'For å bruke eget bilde, velg «Mitt eget bilde eller PDF» under Cockpit først.' })); return; } return cur.img ? stackPicture(fl) : addPicture(fl); };
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { const fl = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!fl) return; e.preventDefault(); takeFile(fl); });
  document.addEventListener('paste', e => { if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.kind === 'file'); if (it) takeFile(it.getAsFile()); });
  document.addEventListener('keydown', e => { if (mode !== 'build' || !cur) return; const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && sel) { e.preventDefault(); F.delStep(cur, sel); sel = null; save(); draw(); panel(); } });
  $('fimp').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
  new MutationObserver(() => { flowSel(); panel(); if (cur && cur.ac === 'img' && !imgURL) bg(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  // a shared link (#f=…) opens as a copy in My flows
  const h = location.hash.match(/#f=([\w-]+)/); let first = null;
  if (h) { const f = F.decode(h[1]); if (f) { if (!FL.some(x => x.id === f.id)) { FL.unshift(f); save(); } first = FL.find(x => x.id === f.id); history.replaceState(null, '', location.pathname); setTimeout(() => msg(f.ac === 'img' ? L({ en: 'Flow opened from a link. It was drawn on a photo: add your own cockpit picture under Cockpit.', no: 'Flowen er åpnet fra en lenke. Den er tegnet på et bilde: legg til ditt eget cockpitbilde under Cockpit.' }) : L({ en: 'Flow opened from a link and saved in My flows.', no: 'Flowen er åpnet fra en lenke og lagret i Mine flows.' }), 'ok'), 300); } }
  // from a cockpit page (#ac=b200): your newest flow on that cockpit, else its example
  const ha = location.hash.match(/#ac=([\w-]+)/); if (!first && ha && (A.get(ha[1]) || A.photo(ha[1]))) { first = FL.find(f => f.ac === ha[1]) || F.example(ha[1], A); history.replaceState(null, '', location.pathname); }
  if (!first) { let last = ''; try { last = localStorage.getItem('bb-flows-last') || ''; } catch (e) {} first = last.startsWith('ex:') ? F.example(last.slice(3), A) : FL.find(f => f.id === last) || FL[0] || F.example('a320', A); }
  open(first).then(() => { const rm = location.hash.match(/room=([\w-]+)/); let back = null; try { back = JSON.parse(sessionStorage.getItem('bb-flows-room') || 'null'); } catch (e) {}
    if (rm) { setMode('together'); if (back && back.code === rm[1]) rJoin(back.code, back.me); }
    else if (back && back.code) { if (back.host) { RM.code = back.code; RM.me = back.me; RM.host = true; RM.role = back.role; rPoll(); } else rJoin(back.code, back.me); } });
  window.BBFLOWS = { RM, SZ, get P() { return P; }, get cur() { return cur; }, get role() { return role; }, draw, ripple, banner, now, col, open, save, panel, H, get ac() { return ac; }, setMode, get mode() { return mode; }, msg, acOpts, addFlow: async f => { FL.unshift(f); await open(f); save(); } };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
