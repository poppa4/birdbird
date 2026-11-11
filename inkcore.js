/* Birdbird – pen notebook and PDF ink, core logic (no DOM): runs in the browser (window.INKCORE) and in node tests.
   Page space   every page is 2100 units wide (0.1 mm on A4); an A4 page is 2100 x 2970. A PDF page keeps its own
                height (2100 x ratio). Strokes are stored in page units, so zoom and screen size never change them.
   A stroke     in memory { t:'p' pen | 'h' highlighter, c:'#rrggbb', w: width in units, s: 1 when the pressure was
                simulated (mouse, finger), pts:[x, y, p, x, y, p, …] } with x, y integers and p 0..31.
                Stored as one short string: "p|1b2430|18|1|<points>", points delta coded, zigzag, 5 bits per
                character in the base64url alphabet (bit 6 = more follows). About 3 bytes per point.
   A notebook   one item of kind 'notebook' in the 'ink' sync namespace:
                { id, kind, title, paper, pages:[{ id, paper?, ink:[stroke strings], tx:[text boxes], im:[images] }],
                  imgs:{ id: data URL }, versions:[{ at, pages }], vAt, createdAt, updatedAt }
   PDF ink      one item per document: { id:'ink:'+docId, kind:'ink', doc, pages:{ '7': [stroke strings] } }. The PDF
                file itself is never changed.
   Also here    the stroke outline (variable width from pressure, our own perfect-freehand style), eraser and lasso
                hit tests, the paper and template drawings as vector primitives, and a small PDF writer (JPEG pages). */
(function (G) {
  'use strict';
  const PW = 2100, PH = 2970;                    // A4 in 0.1 mm
  const MAX_PAGES = 300, MAX_STROKES = 6000, MAX_VERSIONS = 8, VERSION_GAP = 10 * 60e3;
  const PAPERS = ['blank', 'lined', 'grid', 'dots', 'approach'];
  const TEMPLATES = ['approach'];
  const PENS = ['#1B2430', '#1D4E9E', '#C0322B', '#9A1E68', '#2E7D4F', '#B7791F'];       // black, blue, red, accent, green, amber
  const MARKERS = ['#F5D90A', '#7BE07F', '#7CC4FA', '#F7A1D0'];
  const WIDTHS = { p: [9, 16, 28], h: [90, 140, 200], e: [60, 120, 240] };               // units: 0.9, 1.6, 2.8 mm pen

  /* ---------- small helpers ---------- */
  let seq = 0;
  const uid = p => (p || 'x') + Date.now().toString(36) + (seq++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const stamp = (it, now) => Math.max(now || Date.now(), (it && it.updatedAt || 0) + 1);

  /* ---------- point coding ---------- */
  const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const REV = (() => { const r = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) r[ALPH.charCodeAt(i)] = i; return r; })();
  function putNum(out, v) { let z = v < 0 ? (-v * 2 - 1) : v * 2; do { const b = z & 31; z = Math.floor(z / 32); out.push(ALPH[b | (z ? 32 : 0)]); } while (z); }
  function encodePts(pts) {
    const out = []; let px = 0, py = 0, pp = 0;
    for (let i = 0; i + 2 < pts.length; i += 3) { const x = Math.round(pts[i]), y = Math.round(pts[i + 1]), p = clamp(Math.round(pts[i + 2]), 0, 31); putNum(out, x - px); putNum(out, y - py); putNum(out, p - pp); px = x; py = y; pp = p; }
    return out.join('');
  }
  function decodePts(s) {
    const nums = []; let z = 0, mul = 1;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i), v = c < 128 ? REV[c] : -1; if (v < 0) return null; z += (v & 31) * mul; if (v & 32) { mul *= 32; continue; } nums.push(z % 2 ? -(z + 1) / 2 : z / 2); z = 0; mul = 1; }
    if (mul !== 1 || nums.length % 3) return null;
    for (let i = 3; i < nums.length; i++) nums[i] += nums[i - 3];
    return nums;
  }
  const HEX = /^[0-9a-fA-F]{6}$/;
  function encodeStroke(st) { return (st.t === 'h' ? 'h' : 'p') + '|' + String(st.c || '#000000').replace('#', '').slice(0, 6) + '|' + clamp(Math.round(st.w || 16), 1, 400) + '|' + (st.s ? 1 : 0) + '|' + encodePts(st.pts); }
  function decodeStroke(s) {
    if (typeof s !== 'string' || s.length > 200000) return null;
    const a = s.split('|'); if (a.length !== 5 || (a[0] !== 'p' && a[0] !== 'h') || !HEX.test(a[1])) return null;
    const pts = decodePts(a[4]); if (!pts || !pts.length) return null;
    return { t: a[0], c: '#' + a[1].toUpperCase(), w: clamp(+a[2] || 16, 1, 400), s: a[3] === '1' ? 1 : 0, pts };
  }

  /* ---------- the outline of a stroke ---------- */
  /* pts: flat [x, y, p(0..31)…]. opts: { size, thinning, streamline, simulate }. -> polygon [[x, y], …] */
  function outline(pts, o) {
    o = o || {}; const size = o.size || 16, thinning = o.thinning == null ? 0.6 : o.thinning, sl = o.streamline == null ? 0.45 : o.streamline, sim = !!o.simulate;
    const n = pts.length / 3; if (!n) return [];
    const t = 0.15 + (1 - sl) * 0.85;
    /* 1. streamline: each point follows the previous one, which smooths the shaking hand */
    const P = [{ x: pts[0], y: pts[1], p: pts[2] / 31, d: 0 }];
    for (let i = 1; i < n; i++) {
      const q = P[P.length - 1], x = q.x + (pts[i * 3] - q.x) * t, y = q.y + (pts[i * 3 + 1] - q.y) * t, d = Math.hypot(x - q.x, y - q.y);
      if (d < 0.6 && i < n - 1) continue;
      P.push({ x, y, p: pts[i * 3 + 2] / 31, d });
    }
    /* the line ends where the pen was lifted */
    if (n > 1) { const q = P[P.length - 1], lx = pts[n * 3 - 3], ly = pts[n * 3 - 2], d = Math.hypot(lx - q.x, ly - q.y); if (d > 0.6) P.push({ x: lx, y: ly, p: pts[n * 3 - 1] / 31, d }); }
    /* 2. pressure: real from a pen, or from speed (fast = thin) for a mouse or a finger */
    let prev = sim ? 0.5 : P[0].p;
    const rad = [];
    for (let i = 0; i < P.length; i++) {
      let pr;
      if (sim) { const sp = Math.min(1, P[i].d / size), rp = Math.min(1, 1 - sp); pr = Math.min(1, prev + (rp - prev) * (sp * 0.3 + 0.08)); }
      else { pr = i ? prev + (P[i].p - prev) * 0.5 : P[0].p; }
      prev = pr;
      rad.push(Math.max(0.25, size * (0.5 - thinning * (0.5 - pr))));
    }
    if (P.length === 1) return circle(P[0].x, P[0].y, rad[0], 16);
    /* 3. offset left and right along the normal; round caps at both ends */
    const L = [], R = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const r = rad[i];
      L.push([P[i].x - dy * r, P[i].y + dx * r]); R.push([P[i].x + dy * r, P[i].y - dx * r]);
    }
    const cap = (c, r, from, steps) => { const out = []; for (let k = 1; k < steps; k++) { const an = from - Math.PI * k / steps; out.push([c.x + Math.cos(an) * r, c.y + Math.sin(an) * r]); } return out; };
    const e = P[P.length - 1], s0 = P[0];
    const endAng = Math.atan2(L[L.length - 1][1] - e.y, L[L.length - 1][0] - e.x);
    const startAng = Math.atan2(R[0][1] - s0.y, R[0][0] - s0.x);
    return L.concat(cap(e, rad[rad.length - 1], endAng, 8), R.reverse(), cap(s0, rad[0], startAng, 8));
  }
  function circle(x, y, r, n) { const out = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return out; }
  const r1 = v => Math.round(v * 10) / 10;
  /* polygon -> SVG path with quadratic curves through the midpoints (smooth edges, few points) */
  function toPath(poly) {
    if (poly.length < 3) return '';
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let s = 'M' + r1(m(poly[0], poly[1])[0]) + ' ' + r1(m(poly[0], poly[1])[1]);
    for (let i = 1; i <= poly.length; i++) { const a = poly[i % poly.length], b = poly[(i + 1) % poly.length], c = m(a, b); s += 'Q' + r1(a[0]) + ' ' + r1(a[1]) + ' ' + r1(c[0]) + ' ' + r1(c[1]); }
    return s + 'Z';
  }
  const strokeOpts = st => st.t === 'h' ? { size: st.w, thinning: 0, streamline: 0.72, simulate: false } : { size: st.w, thinning: 0.6, streamline: 0.45, simulate: !!st.s };
  function bbox(st) {
    if (st._bb) return st._bb; const p = st.pts; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
    const pad = st.w; return (st._bb = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 });
  }
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const union = (a, b) => !a ? b : !b ? a : { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) };

  /* ---------- erasing and selecting ---------- */
  function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = clamp(t, 0, 1); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
  /* does an eraser of radius r at (x, y) touch the stroke? */
  function hitStroke(st, x, y, r) {
    const b = bbox(st); if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) return false;
    const p = st.pts, lim = r + st.w / 2;
    if (p.length === 3) return Math.hypot(p[0] - x, p[1] - y) <= lim;
    for (let i = 3; i < p.length; i += 3) if (segDist(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) <= lim) return true;
    return false;
  }
  /* the partial eraser: the pieces of the stroke left after rubbing out a circle; null when it is not touched */
  function eraseStroke(st, x, y, r) {
    if (!hitStroke(st, x, y, r)) return null;
    const p = st.pts, lim = r + st.w * 0.25, step = Math.max(2, r / 3), dense = [p[0], p[1], p[2]];
    for (let i = 3; i < p.length; i += 3) {
      const ax = p[i - 3], ay = p[i - 2], bx = p[i], by = p[i + 1];
      if (segDist(x, y, ax, ay, bx, by) <= lim) { const k = Math.ceil(Math.hypot(bx - ax, by - ay) / step); for (let j = 1; j < k; j++) { const f = j / k; dense.push(Math.round(ax + (bx - ax) * f), Math.round(ay + (by - ay) * f), Math.round(p[i - 1] + (p[i + 2] - p[i - 1]) * f)); } }
      dense.push(bx, by, p[i + 2]);
    }
    const out = []; let cur = [];
    for (let i = 0; i < dense.length; i += 3) {
      if (Math.hypot(dense[i] - x, dense[i + 1] - y) <= lim) { if (cur.length >= 6) out.push(cur); cur = []; }
      else cur.push(dense[i], dense[i + 1], dense[i + 2]);
    }
    if (cur.length >= 6) out.push(cur);
    return out.map(pts => ({ t: st.t, c: st.c, w: st.w, s: st.s, pts }));
  }
  function inPoly(x, y, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
  /* lasso: a stroke is selected when most of its points are inside */
  function lassoHit(st, poly) { const p = st.pts, n = p.length / 3, every = Math.max(1, Math.floor(n / 40)); let a = 0, b = 0; for (let i = 0; i < n; i += every) { b++; if (inPoly(p[i * 3], p[i * 3 + 1], poly)) a++; } return b > 0 && a / b >= 0.6; }
  function moveStroke(st, dx, dy) { const pts = st.pts.slice(); for (let i = 0; i < pts.length; i += 3) { pts[i] = Math.round(pts[i] + dx); pts[i + 1] = Math.round(pts[i + 1] + dy); } return { t: st.t, c: st.c, w: st.w, s: st.s, pts }; }
  function recolor(st, c) { return { t: st.t, c, w: st.w, s: st.s, pts: st.pts }; }

  /* ---------- notebooks ---------- */
  const cleanTitle = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const okPaper = p => PAPERS.includes(p) ? p : null;
  const newPage = paper => { const pg = { id: uid('pg'), ink: [], tx: [], im: [] }; if (okPaper(paper)) pg.paper = paper; return pg; };
  function newNotebook(f, now) {
    f = f || {}; now = now || Date.now();
    return { id: f.id || uid('nb'), kind: 'notebook', title: cleanTitle(f.title), paper: okPaper(f.paper) || 'grid', pages: [newPage(f.firstPaper)], imgs: {}, versions: [], createdAt: now, updatedAt: now };
  }
  const paperOf = (nb, pg) => (pg && okPaper(pg.paper)) || okPaper(nb.paper) || 'blank';
  const clonePage = pg => ({ id: pg.id, paper: pg.paper, ink: (pg.ink || []).slice(), tx: (pg.tx || []).map(x => Object.assign({}, x)), im: (pg.im || []).map(x => Object.assign({}, x)) });
  const withPages = (nb, pages) => Object.assign({}, nb, { pages });
  function addPage(nb, at, paper) { if (nb.pages.length >= MAX_PAGES) return nb; const pages = nb.pages.slice(), i = at == null ? pages.length : clamp(at, 0, pages.length); pages.splice(i, 0, newPage(paper)); return withPages(nb, pages); }
  function duplicatePage(nb, i) { if (nb.pages.length >= MAX_PAGES || !nb.pages[i]) return nb; const pages = nb.pages.slice(), c = clonePage(pages[i]); c.id = uid('pg'); c.tx.forEach(x => { x.id = uid('t'); }); c.im.forEach(x => { x.id = uid('m'); }); pages.splice(i + 1, 0, c); return withPages(nb, pages); }
  function deletePage(nb, i) { if (!nb.pages[i]) return nb; const pages = nb.pages.slice(); pages.splice(i, 1); if (!pages.length) pages.push(newPage()); return withPages(nb, pages); }
  function movePage(nb, from, to) { if (!nb.pages[from]) return nb; to = clamp(to, 0, nb.pages.length - 1); if (to === from) return nb; const pages = nb.pages.slice(), [p] = pages.splice(from, 1); pages.splice(to, 0, p); return withPages(nb, pages); }
  /* page index null = the whole notebook (pages that chose their own paper keep it unless all is set) */
  function setPaper(nb, i, paper, all) {
    if (!okPaper(paper)) return nb;
    if (i == null) { const o = Object.assign({}, nb, { paper }); if (all) o.pages = nb.pages.map(p => { const c = Object.assign({}, p); delete c.paper; return c; }); return o; }
    const pages = nb.pages.slice(); if (!pages[i]) return nb; pages[i] = Object.assign({}, pages[i], { paper }); return withPages(nb, pages);
  }
  /* images no page and no version refers to any more are dropped */
  function pruneImgs(nb) {
    const used = new Set(); const walk = pages => (pages || []).forEach(p => (p.im || []).forEach(m => used.add(m.k)));
    walk(nb.pages); (nb.versions || []).forEach(v => walk(v.pages));
    const imgs = {}; let changed = false; for (const k in nb.imgs || {}) { if (used.has(k)) imgs[k] = nb.imgs[k]; else changed = true; }
    return changed ? Object.assign({}, nb, { imgs }) : nb;
  }
  const pagesKey = pages => JSON.stringify(pages);
  /* save: the pages as they were before a burst of writing are kept as a version (at most every ten minutes, or when force) */
  function saveNotebook(prev, next, now, force) {
    now = now || Date.now(); const o = Object.assign({}, next);
    const changed = pagesKey(prev.pages) !== pagesKey(next.pages);
    if (changed && hasInk(prev)) {
      const last = (prev.versions || [])[(prev.versions || []).length - 1], taken = prev.vAt || (last && last.at) || 0;
      if (force || !last || now - taken >= VERSION_GAP) { o.versions = (prev.versions || []).concat([{ at: prev.updatedAt, pages: prev.pages }]).slice(-MAX_VERSIONS); o.vAt = now; }
    }
    o.updatedAt = stamp(prev, now);
    return pruneImgs(o);
  }
  const hasInk = nb => (nb.pages || []).some(p => (p.ink || []).length || (p.tx || []).some(x => x.s) || (p.im || []).length);
  function restoreVersion(nb, at, now) { const v = (nb.versions || []).find(x => x.at === at); if (!v) return nb; return saveNotebook(nb, Object.assign({}, nb, { pages: v.pages }), now, true); }
  /* closing the notebook: the pages as they were when it was opened are kept as a version, if they changed since */
  function closeSession(nb, openPages, openAt, now) {
    if (!openPages || pagesKey(openPages) === pagesKey(nb.pages) || (nb.versions || []).some(v => v.at === openAt) || !(openPages || []).some(p => (p.ink || []).length || (p.tx || []).length || (p.im || []).length)) return nb;
    const o = Object.assign({}, nb, { versions: (nb.versions || []).concat([{ at: openAt, pages: openPages }]).sort((a, b) => a.at - b.at).slice(-MAX_VERSIONS), vAt: now || Date.now() });
    o.updatedAt = stamp(nb, now); return o;
  }
  const strokeCount = nb => (nb.pages || []).reduce((a, p) => a + (p.ink || []).length, 0);
  /* text the search can find: the title and the typed text boxes */
  const notebookText = nb => (nb.pages || []).flatMap(p => (p.tx || []).map(x => x.s || '')).join(' ').slice(0, 20000);

  /* from storage, another device or a backup file: never trust the shape */
  const ID = /^[A-Za-z0-9_:.-]{1,60}$/;
  const num = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  function cleanInk(list, cap) { const out = []; (Array.isArray(list) ? list : []).forEach(s => { if (out.length < (cap || MAX_STROKES) && typeof s === 'string' && s.length < 200000 && decodeStroke(s)) out.push(s); }); return out; }
  function cleanPage(p) {
    if (!p || typeof p !== 'object') return null;
    const o = { id: ID.test(p.id) ? p.id : uid('pg'), ink: cleanInk(p.ink), tx: [], im: [] }; if (okPaper(p.paper)) o.paper = p.paper;
    (Array.isArray(p.tx) ? p.tx : []).slice(0, 60).forEach(x => { if (x && typeof x === 'object') o.tx.push({ id: ID.test(x.id) ? x.id : uid('t'), x: num(x.x, 0, PW, 100), y: num(x.y, 0, 9000, 100), w: num(x.w, 120, PW, 900), fs: num(x.fs, 20, 200, 44), c: HEX.test(String(x.c || '').replace('#', '')) ? x.c : '#1B2430', s: String(x.s || '').slice(0, 4000) }); });
    (Array.isArray(p.im) ? p.im : []).slice(0, 20).forEach(m => { if (m && typeof m === 'object' && ID.test(m.k)) o.im.push({ id: ID.test(m.id) ? m.id : uid('m'), k: m.k, x: num(m.x, -PW, PW * 2, 0), y: num(m.y, -PH, PH * 3, 0), w: num(m.w, 20, PW * 2, 600), h: num(m.h, 20, PH * 3, 400) }); });
    return o;
  }
  function cleanNotebook(raw) {
    if (!raw || typeof raw !== 'object' || raw.gone) return raw;
    const pages = (Array.isArray(raw.pages) ? raw.pages : []).slice(0, MAX_PAGES).map(cleanPage).filter(Boolean);
    const imgs = {}; if (raw.imgs && typeof raw.imgs === 'object') for (const k in raw.imgs) { const v = raw.imgs[k]; if (ID.test(k) && typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 3e6) imgs[k] = v; }
    const versions = (Array.isArray(raw.versions) ? raw.versions : []).slice(-MAX_VERSIONS).map(v => ({ at: +v.at || 0, pages: (Array.isArray(v.pages) ? v.pages : []).slice(0, MAX_PAGES).map(cleanPage).filter(Boolean), conflict: v.conflict ? 1 : undefined }));
    return Object.assign({}, raw, { title: cleanTitle(raw.title), paper: okPaper(raw.paper) || 'grid', pages: pages.length ? pages : [newPage()], imgs, versions });
  }
  function cleanDocInk(raw) {
    if (!raw || typeof raw !== 'object' || raw.gone) return raw;
    const pages = {}; if (raw.pages && typeof raw.pages === 'object') for (const k in raw.pages) { if (/^\d{1,5}$/.test(k)) { const l = cleanInk(raw.pages[k]); if (l.length) pages[k] = l; } }
    return Object.assign({}, raw, { pages });
  }
  const docInkId = docId => 'ink:' + docId;
  const newDocInk = (docId, now) => ({ id: docInkId(docId), kind: 'ink', doc: String(docId), pages: {}, createdAt: now || Date.now(), updatedAt: now || Date.now() });

  /* ---------- paper and templates: vector primitives in page units ---------- */
  /* -> [{ k:'line', x1, y1, x2, y2, w, c } | { k:'rect', x, y, w, h, c?, f?, lw? } | { k:'text', x, y, t, s, c, b?, m?, al? } | { k:'dots', x0, y0, dx, dy, nx, ny, r, c } | { k:'circle', x, y, r, c, lw }] */
  const C = { rule: '#C9D3DA', faint: '#E3E8EC', mid: '#9AA8B2', ink: '#13202A', ink2: '#4C5B66', accent: '#9A1E68', wash: '#F4F6F7', margin: '#E8B8CF' };
  function paperPrims(paper, h, lang) {
    h = h || PH; const no = lang === 'no', T = (en, nb) => no ? nb : en, out = [];
    const line = (x1, y1, x2, y2, c, w) => out.push({ k: 'line', x1, y1, x2, y2, c: c || C.rule, w: w || 2.2 });
    const rect = (x, y, w, hh, o) => out.push(Object.assign({ k: 'rect', x, y, w, h: hh, c: C.mid, lw: 2.4 }, o || {}));
    const text = (x, y, t, o) => out.push(Object.assign({ k: 'text', x, y, t, s: 30, c: C.ink2 }, o || {}));
    const label = (x, y, t) => text(x, y, t.toUpperCase(), { s: 24, c: C.ink2, m: 1 });
    const lines = (x, y, w, hh, step) => { for (let yy = y + step; yy < y + hh - 4; yy += step) line(x, yy, x + w, yy, C.faint, 2); };
    const title = (t, sub) => { text(100, 150, t, { s: 64, c: C.ink, b: 1 }); if (sub) text(PW - 100, 150, sub, { s: 26, c: C.ink2, m: 1, al: 'r' }); line(100, 185, PW - 100, 185, C.ink, 4); };
    /* a labelled box with writing lines */
    const field = (x, y, w, hh, lab, step) => { rect(x, y, w, hh); label(x + 16, y + 34, lab); if (step) lines(x + 12, y + 44, w - 24, hh - 44, step); };
    if (paper === 'lined') { for (let y = 330; y < h - 80; y += 80) line(0, y, PW, y, C.rule, 2.4); line(250, 0, 250, h, C.margin, 2.4); }
    else if (paper === 'grid') { for (let x = 50; x < PW; x += 50) line(x, 0, x, h, (x % 500) ? C.faint : C.rule, (x % 500) ? 1.8 : 2.2); for (let y = 50; y < h; y += 50) line(0, y, PW, y, (y % 500) ? C.faint : C.rule, (y % 500) ? 1.8 : 2.2); }
    else if (paper === 'dots') out.push({ k: 'dots', x0: 50, y0: 50, dx: 50, dy: 50, nx: Math.floor((PW - 1) / 50), ny: Math.floor((h - 1) / 50), r: 3.2, c: C.mid });
    else if (paper === 'approach') {
      title(T('Approach briefing', 'Innflygingsbrief'), T('Plan · brief · fly', 'Planlegg · brief · fly'));
      const g = 30, x0 = 100, W = PW - 200, half = (W - g) / 2, third = (W - 2 * g) / 3;
      field(x0, 240, third, 150, T('Airport', 'Flyplass')); field(x0 + third + g, 240, third, 150, T('Runway', 'Rullebane')); field(x0 + 2 * (third + g), 240, third, 150, T('Chart / date', 'Kart / dato'));
      field(x0, 420, W, 230, T('Procedure', 'Prosedyre'), 80);
      rect(x0, 680, half, 380); label(x0 + 16, 714, T('Minima', 'Minima'));
      [['DA / MDA', 790], ['RVR / VIS', 890], [T('Ceiling', 'Skydekke'), 990]].forEach(([l, yy]) => { text(x0 + 24, yy, l, { s: 30, c: C.ink, m: 1 }); line(x0 + 330, yy + 6, x0 + half - 30, yy + 6, C.faint, 2); });
      const mx = x0 + half + g; rect(mx, 680, half, 380); label(mx + 16, 714, 'MSA'); const cx = mx + half / 2, cy = 890, rr = 140;
      out.push({ k: 'circle', x: cx, y: cy, r: rr, c: C.mid, lw: 2.4 }); line(cx - rr, cy, cx + rr, cy, C.faint, 2); line(cx, cy - rr, cx, cy + rr, C.faint, 2); text(cx, cy - rr - 10, 'N', { s: 26, c: C.ink2, m: 1, al: 'c' });
      rect(x0, 1090, W, 400); label(x0 + 16, 1124, T('Frequencies', 'Frekvenser'));
      const fq = ['ATIS', 'APP', 'TWR', 'GND', 'ILS / NAV', T('Course', 'Kurs')]; fq.forEach((f, i) => { const col = i % 3, row = Math.floor(i / 3), fx = x0 + 24 + col * (W / 3), fy = 1230 + row * 150; text(fx, fy, f, { s: 30, c: C.ink, m: 1 }); line(fx + 190, fy + 6, fx + W / 3 - 60, fy + 6, C.faint, 2); });
      field(x0, 1520, W, 520, T('Missed approach', 'Avbrutt innflyging'), 80);
      field(x0, 2070, W, h - 2070 - 100, T('Threats and notes', 'Trusler og notater'), 80);
    }
    return out;
  }
  const PAPER_NAMES = { blank: ['Blank', 'Blank'], lined: ['Lined', 'Linjert'], grid: ['Grid (5 mm)', 'Rutenett (5 mm)'], dots: ['Dot grid', 'Prikker'], approach: ['Approach briefing', 'Innflygingsbrief'] };

  /* ---------- a small PDF writer: one JPEG per page ---------- */
  /* pages: [{ jpeg: Uint8Array, w, h (pixels), pw, ph (points) }], info?: { title } -> Uint8Array */
  function pdfFromJpegs(pages, info) {
    const enc = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    const parts = [], offs = []; let pos = 0;
    const push = u => { parts.push(u); pos += u.length; };
    const obj = (n, body, stream) => { offs[n] = pos; push(enc(n + ' 0 obj\n' + body + (stream ? '\nstream\n' : '\nendobj\n'))); if (stream) { push(stream); push(enc('\nendstream\nendobj\n')); } };
    const n = pages.length, total = 4 + n * 3;
    push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    const title = String((info && info.title) || 'Birdbird').replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '\\$&').slice(0, 120);
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + pages.map((_, i) => (4 + i * 3) + ' 0 R').join(' ') + '] >>');
    obj(3, '<< /Title (' + title + ') /Producer (Birdbird) >>');
    pages.forEach((p, i) => {
      const po = 4 + i * 3, co = po + 1, io = po + 2, pw = +(p.pw || 595.28).toFixed(2), ph = +(p.ph || 841.89).toFixed(2);
      obj(po, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im' + i + ' ' + io + ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' + co + ' 0 R >>');
      const cs = enc('q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im' + i + ' Do Q');
      obj(co, '<< /Length ' + cs.length + ' >>', cs);
      obj(io, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>', p.jpeg);
    });
    const xref = pos; let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(enc(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
    const out = new Uint8Array(pos); let o = 0; parts.forEach(u => { out.set(u, o); o += u.length; }); return out;
  }

  const API = { PW, PH, MAX_PAGES, MAX_STROKES, MAX_VERSIONS, VERSION_GAP, PAPERS, TEMPLATES, PENS, MARKERS, WIDTHS, PAPER_NAMES, uid,
    encodePts, decodePts, encodeStroke, decodeStroke, outline, toPath, strokeOpts, bbox, hits, union, segDist, hitStroke, eraseStroke, inPoly, lassoHit, moveStroke, recolor,
    newNotebook, newPage, paperOf, addPage, duplicatePage, deletePage, movePage, setPaper, saveNotebook, closeSession, restoreVersion, pruneImgs, hasInk, strokeCount, notebookText,
    cleanNotebook, cleanDocInk, cleanInk, docInkId, newDocInk, paperPrims, pdfFromJpegs };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.INKCORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
