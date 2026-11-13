/* Birdbird – My workspace: the pen notebook and ink on PDF pages (desk tabs). Pure logic in inkcore.js.
   One ink engine (Ink below) serves both: pages are canvases drawn from vector strokes, input comes from Pointer Events.
     pen         pressure from the pen, coalesced events for smooth lines, palm rejection: once a pen is seen,
                 fingers never draw, they scroll and pinch. Mouse draws on a desktop. A finger draws only when the
                 "finger" switch is on and no pen has been used.
     speed       the stroke being drawn lives on one small overlay canvas; when it is finished only its own area of
                 the page is drawn again. Pages far from view give their canvases back (at most 8 kept).
     touch       touch-action:none only on the page in view (class .act); there one finger pans and two pinch,
                 everywhere else the browser scrolls. Pencil touches never scroll (touchType 'stylus').
   desk.js calls WSNB.init(helpers) once and then WSNB.mountNotebook / WSNB.annotator. */
(function () {
  'use strict';
  const I = window.INKCORE, PW = I.PW;
  let X = null;                              // helpers from desk.js
  const t = (en, no) => X.t(en, no), esc = s => X.esc(s);
  const dprCap = () => Math.min(2, window.devicePixelRatio || 1);
  const LSK = 'bb-nb-tools', PENK = 'bb-nb-pen';
  const ls = (k, v) => { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } };

  /* ---------- the pen: one set of tools for every notebook and PDF, like a real pencil case ---------- */
  /* on a phone there is no pen, so the finger draws from the start (two fingers scroll); a tablet waits for the switch */
  const PHONE = (() => { try { return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; } catch (e) { return false; } })();
  const TOOLS = Object.assign({ tool: 'pen', pc: 0, pw: 1, hc: 0, hw: 1, em: 'stroke', ew: 1, finger: PHONE }, (() => { try { return JSON.parse(ls(LSK)) || {}; } catch (e) { return {}; } })());
  let penSeen = ls(PENK) === '1';
  const saveTools = () => ls(LSK, JSON.stringify(TOOLS));
  const fingerDraws = () => TOOLS.finger && !penSeen;

  /* ---------- drawing ---------- */
  const decoded = new Map();                 // stroke string -> stroke (with its cached Path2D)
  function S(s) { let o = decoded.get(s); if (o === undefined) { o = I.decodeStroke(s); decoded.set(s, o); if (decoded.size > 60000) decoded.delete(decoded.keys().next().value); } return o; }
  const pathOf = st => st._p || (st._p = new Path2D(I.toPath(I.outline(st.pts, I.strokeOpts(st)))));
  const primCache = new Map();
  function prims(paper, h) { const k = paper + ':' + h + ':' + X.lang(); let p = primCache.get(k); if (!p) { p = I.paperPrims(paper, h, X.lang()); primCache.set(k, p); } return p; }
  const FONT = { b: '"Archivo","Arial Narrow",system-ui,sans-serif', m: '"IBM Plex Mono",ui-monospace,Menlo,monospace', r: '"Public Sans",system-ui,-apple-system,sans-serif' };
  function drawPrims(ctx, list) {
    const lines = new Map();
    for (const p of list) {
      if (p.k === 'line') { const key = p.c + '|' + p.w; let a = lines.get(key); if (!a) lines.set(key, a = []); a.push(p); }
      else if (p.k === 'rect') { if (p.f) { ctx.fillStyle = p.f; ctx.fillRect(p.x, p.y, p.w, p.h); } ctx.strokeStyle = p.c; ctx.lineWidth = p.lw || 2.4; ctx.strokeRect(p.x, p.y, p.w, p.h); }
      else if (p.k === 'text') { ctx.fillStyle = p.c; ctx.font = (p.b ? '700 ' : p.m ? '500 ' : '400 ') + p.s + 'px ' + (p.b ? FONT.b : p.m ? FONT.m : FONT.r); ctx.textAlign = p.al === 'r' ? 'right' : p.al === 'c' ? 'center' : 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(p.t, p.x, p.y); }
      else if (p.k === 'dots') { ctx.fillStyle = p.c; const r = p.r; for (let j = 1; j <= p.ny; j++) for (let i = 1; i <= p.nx; i++) ctx.fillRect(p.x0 + (i - 1) * p.dx - r, p.y0 + (j - 1) * p.dy - r, r * 2, r * 2); }
      else if (p.k === 'circle') { ctx.strokeStyle = p.c; ctx.lineWidth = p.lw || 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
    }
    lines.forEach((a, key) => { const [c, w] = key.split('|'); ctx.strokeStyle = c; ctx.lineWidth = +w; ctx.beginPath(); a.forEach(p => { ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); }); ctx.stroke(); });
  }
  const imgEls = new Map();                  // image id -> HTMLImageElement
  function imgEl(k, src, onload) { let im = imgEls.get(k); if (!im && src) { im = new Image(); im.onload = () => onload && onload(); im.src = src; imgEls.set(k, im); } return im && im.complete && im.naturalWidth ? im : null; }
  /* paint one page (or the region reg of it, in page units) onto ctx. o: { scale, h, bg, paper, ink, im, imgs, tx, skip:Set, onImg } */
  function paint(ctx, o, reg) {
    ctx.save(); ctx.setTransform(o.scale, 0, 0, o.scale, 0, 0);
    const r = reg ? { x: Math.floor(reg.x - 2), y: Math.floor(reg.y - 2), w: Math.ceil(reg.w + 4), h: Math.ceil(reg.h + 4) } : { x: 0, y: 0, w: PW, h: o.h };
    if (reg) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
    if (o.bg) { ctx.fillStyle = '#fff'; ctx.fillRect(r.x, r.y, r.w, r.h); drawPrims(ctx, prims(o.paper, o.h)); }
    else ctx.clearRect(r.x, r.y, r.w, r.h);
    (o.im || []).forEach(m => { if (o.skip && o.skip.has('m:' + m.id)) return; const el = imgEl(m.k, (o.imgs || {})[m.k], o.onImg); if (el && I.hits(r, m)) ctx.drawImage(el, m.x, m.y, m.w, m.h); });
    const list = (o.ink || []).map(s => (o.skip && o.skip.has(s)) ? null : S(s)).filter(st => st && I.hits(r, I.bbox(st)));
    ctx.globalAlpha = 0.42; if (o.bg) ctx.globalCompositeOperation = 'multiply';
    list.forEach(st => { if (st.t === 'h') { ctx.fillStyle = st.c; ctx.fill(pathOf(st)); } });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    list.forEach(st => { if (st.t !== 'h') { ctx.fillStyle = st.c; ctx.fill(pathOf(st)); } });
    if (o.tx) o.tx.forEach(b => drawText(ctx, b));
    ctx.restore();
  }
  /* a text box drawn into a picture (thumbnails and export); on the page it is a real text field */
  function drawText(ctx, b) {
    if (!b.s) return; ctx.fillStyle = b.c || '#1B2430'; ctx.font = '400 ' + b.fs + 'px ' + FONT.r; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let y = b.y + 6; const lh = b.fs * 1.32;
    String(b.s).split('\n').forEach(par => { let line = ''; par.split(/(\s+)/).forEach(w => { const tr = line + w; if (ctx.measureText(tr).width > b.w - 16 && line.trim()) { ctx.fillText(line.trim(), b.x + 8, y); y += lh; line = w.trimStart(); } else line = tr; }); ctx.fillText(line.trim(), b.x + 8, y); y += lh; });
  }

  /* ---------- the ink engine ---------- */
  /* cfg: { sc, kind:'nb'|'pdf', sel (page selector), keyOf(el), elOf(key), canvasOf(key), hOf(key), data(key) -> { ink, im, tx },
          set(key, data), bg, paperOf(key), imgs(), on() -> drawing allowed, onTap(key, x, y), pinch: { move(s, cx, cy), end(s, cx, cy) }, onSel(sel|null) } */
  function Ink(cfg) {
    const sc = cfg.sc, undo = [], redo = [];
    let cur = null, raf = 0, live = null, sel = null, act = null;
    const touches = new Map(); let gest = null, mom = 0;
    const opts = (key, extra) => { const d = cfg.data(key), cv = cfg.canvasOf(key); return Object.assign({ scale: cv ? cv.width / PW : 1, h: cfg.hOf(key), bg: cfg.bg, paper: cfg.paperOf ? cfg.paperOf(key) : 'blank', ink: d.ink, im: d.im, imgs: cfg.imgs ? cfg.imgs() : {}, onImg: () => draw(key) }, extra || {}); };
    function draw(key, reg, extra) { const cv = cfg.canvasOf(key); if (!cv || !cv.width) return; paint(cv.getContext('2d'), opts(key, extra), reg || null); }
    function change(key, next, noUndo) {
      const before = snap(cfg.data(key));
      cfg.set(key, next);
      if (!noUndo) { undo.push({ key, before, after: snap(cfg.data(key)) }); if (undo.length > 200) undo.shift(); redo.length = 0; }
      if (cfg.onHist) cfg.onHist();
    }
    const snap = d => ({ ink: (d.ink || []).slice(), im: (d.im || []).map(x => Object.assign({}, x)), tx: (d.tx || []).map(x => Object.assign({}, x)) });
    function step(from, to, k) { const e = from.pop(); if (!e) return false; to.push(e); clearSel(); cfg.set(e.key, snap(e[k])); draw(e.key); if (cfg.onHist) cfg.onHist(e.key); return true; }
    const api = {
      draw, change,
      undo: () => step(undo, redo, 'before'), redo: () => step(redo, undo, 'after'),
      canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
      active(key) { if (act === key) return; const o = act != null && cfg.elOf(act); if (o) o.classList.remove('act'); act = key; const n = key != null && cfg.elOf(key); if (n) n.classList.add('act'); },
      get sel() { return sel; }, clearSel, delSel, recolorSel,
      destroy() { cancelAnimationFrame(raf); cancelAnimationFrame(mom); sc.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); sc.removeEventListener('touchstart', stylus); sc.removeEventListener('touchmove', stylus); sc.removeEventListener('wheel', wheel); if (live) live.remove(); }
    };

    /* the overlay for the stroke being drawn (and the lasso), inside the page */
    function liveOn(el) {
      if (!live) { live = document.createElement('canvas'); live.className = 'ink-live'; }
      if (live.parentNode !== el) el.appendChild(live);
      const w = el.clientWidth, hh = el.clientHeight; let d = dprCap(); while (w * d * hh * d > 6e6 && d > 0.6) d -= 0.2;
      const W2 = Math.round(w * d), H2 = Math.round(hh * d); if (live.width !== W2 || live.height !== H2) { live.width = W2; live.height = H2; } else live.getContext('2d').clearRect(0, 0, W2, H2);
      live._s = W2 / PW; live.style.opacity = '';
      return live;
    }
    function liveClear() { if (live && live.parentNode) { live.getContext('2d').clearRect(0, 0, live.width, live.height); live.remove(); } }

    function pageXY(c, e) { return [(e.clientX - c.rect.left) / c.rect.width * PW, (e.clientY - c.rect.top) / c.rect.height * c.h]; }
    function down(e) {
      const el = e.target.closest(cfg.sel); if (!el || !sc.contains(el)) return;
      if (e.target.closest('.tb,.ink-selbar,button,input')) return;
      const key = cfg.keyOf(el); if (key == null) return;
      if (e.pointerType === 'pen' && !penSeen) { penSeen = true; ls(PENK, '1'); if (cfg.onPen) cfg.onPen(); }
      if (e.pointerType === 'touch') {
        if (!cfg.on()) return;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY, el }); listen();
        if (cur && cur.touch) { abort(); }
        if (touches.size >= 2 || !fingerDraws() || !cfg.on()) { if (el.classList.contains('act') || touches.size >= 2) startGesture(); return; }
      } else if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!cfg.on()) return;
      cancelAnimationFrame(mom);
      const tool = TOOLS.tool, rect = el.getBoundingClientRect(), h = cfg.hOf(key);
      const c = { id: e.pointerId, key, el, rect, h, tool, touch: e.pointerType === 'touch', pen: e.pointerType === 'pen', pts: [], last: 0 };
      const [x, y] = pageXY(c, e);
      if (tool === 'text') { c.tap = [x, y, e.clientX, e.clientY]; cur = c; listen(); return; }
      if (sel && sel.key === key && inBox(sel.bb, x, y)) { c.mode = 'move'; c.x0 = x; c.y0 = y; cur = c; startMove(); listen(); try { el.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); return; }
      clearSel();
      if (tool === 'erase') { c.mode = 'erase'; c.orig = cfg.data(key).ink.slice(); c.ink = c.orig.slice(); c.changed = false; }
      else if (tool === 'lasso') c.mode = 'lasso';
      else c.mode = 'ink';
      cur = c; liveOn(el); if (tool === 'hl') live.style.opacity = '0.42';
      addPts(e); listen();
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      e.preventDefault();
      frame();
    }
    function listen() { window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); }
    function unlisten() { if (touches.size) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); }
    function addPts(e, c) {
      c = c || cur; const list = (e.getCoalescedEvents && e.getCoalescedEvents()) || []; const evs = list.length ? list : [e];
      for (const ev of evs) {
        const [x, y] = pageXY(c, ev);
        let p = 16; if (c.pen) p = ev.pressure > 0 ? Math.round(Math.min(1, ev.pressure) * 31) : (c.lastP || 16);
        if (ev.type === 'pointerup' && c.pen) p = c.lastP || 16;
        c.lastP = p;
        const n = c.pts.length; if (n && Math.abs(c.pts[n - 3] - x) < 0.8 && Math.abs(c.pts[n - 2] - y) < 0.8) continue;
        c.pts.push(x, y, p);
      }
    }
    function move(e) {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) { const tt = touches.get(e.pointerId); tt.x = e.clientX; tt.y = e.clientY; if (gest) { e.preventDefault(); gestMove(); return; } }
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();
      if (cur.tool === 'text') return;
      if (cur.mode === 'move') { const [x, y] = pageXY(cur, e); cur.dx = x - cur.x0; cur.dy = y - cur.y0; frame(); return; }
      addPts(e); frame();
    }
    function frame() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (cur) render(); }); }
    function render() {
      const c = cur, ctx = live && live.getContext('2d');
      if (c.mode === 'ink') {
        ctx.clearRect(0, 0, live.width, live.height); ctx.setTransform(live._s, 0, 0, live._s, 0, 0);
        const st = strokeNow(); ctx.fillStyle = st.c; ctx.fill(new Path2D(I.toPath(I.outline(st.pts, I.strokeOpts(st))))); ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else if (c.mode === 'erase') {
        const r = eraseTo(c);
        ctx.clearRect(0, 0, live.width, live.height); const n = c.pts.length; if (n) { ctx.setTransform(live._s, 0, 0, live._s, 0, 0); ctx.strokeStyle = 'rgba(19,32,42,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.pts[n - 3], c.pts[n - 2], r, 0, Math.PI * 2); ctx.stroke(); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      } else if (c.mode === 'lasso') {
        ctx.clearRect(0, 0, live.width, live.height); ctx.setTransform(live._s, 0, 0, live._s, 0, 0);
        ctx.setLineDash([14, 10]); ctx.strokeStyle = '#1D4E9E'; ctx.lineWidth = 4; ctx.fillStyle = 'rgba(29,78,158,.06)'; ctx.beginPath();
        for (let i = 0; i < c.pts.length; i += 3) ctx[i ? 'lineTo' : 'moveTo'](c.pts[i], c.pts[i + 1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else if (c.mode === 'move') drawSel(c.dx || 0, c.dy || 0);
    }
    /* rub out along the new points of the eraser; the page shows it at once */
    function eraseTo(c) {
      const r = I.WIDTHS.e[TOOLS.ew] / 2; let dirty = null;
      for (let i = c.last || 0; i < c.pts.length; i += 3) {
        const x = c.pts[i], y = c.pts[i + 1], out = [];
        for (const s of c.ink) { const st = S(s); if (!st) continue; if (TOOLS.em === 'part') { const pieces = I.eraseStroke(st, x, y, r); if (pieces) { dirty = I.union(dirty, I.bbox(st)); pieces.forEach(pc => out.push(I.encodeStroke(pc))); c.changed = true; } else out.push(s); } else if (I.hitStroke(st, x, y, r)) { dirty = I.union(dirty, I.bbox(st)); c.changed = true; } else out.push(s); }
        c.ink = out;
      }
      c.last = c.pts.length;
      if (dirty) { cfg.set(c.key, Object.assign(snapT(c.key), { ink: c.ink })); draw(c.key, dirty); }
      return r;
    }
    const snapT = key => { const d = cfg.data(key); return { ink: d.ink, im: d.im, tx: d.tx }; };
    function strokeNow(c) {
      c = c || cur; const hl = c.tool === 'hl';
      return { t: hl ? 'h' : 'p', c: hl ? I.MARKERS[TOOLS.hc] || I.MARKERS[0] : I.PENS[TOOLS.pc] || I.PENS[0], w: hl ? I.WIDTHS.h[TOOLS.hw] : I.WIDTHS.p[TOOLS.pw], s: c.pen ? 0 : 1, pts: c.pts };
    }
    function up(e) {
      if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (gest) { if (touches.size < 1) gestEnd(); else if (touches.size === 1) startGesture(); unlisten(); return; } }
      if (!cur || e.pointerId !== cur.id) { unlisten(); return; }
      const c = cur; cur = null; cancelAnimationFrame(raf); raf = 0;
      if (c.tool === 'text') { const [x, y] = pageXY(c, e); if (Math.hypot(e.clientX - c.tap[2], e.clientY - c.tap[3]) < 10 && cfg.onTap) cfg.onTap(c.key, x, y); unlisten(); return; }
      if (c.mode === 'ink') {
        addPts(e, c);
        if (c.pts.length >= 3) {
          const st = strokeNow(c); st.pts = st.pts.map(Math.round); const s = I.encodeStroke(st), d = cfg.data(c.key);
          if (d.ink.length < I.MAX_STROKES) {
            change(c.key, Object.assign(snapT(c.key), { ink: d.ink.concat([s]) }));
            const ds = S(s);
            if (ds && st.t === 'p' && cfg.canvasOf(c.key)) { const cv = cfg.canvasOf(c.key), ctx = cv.getContext('2d'); ctx.save(); ctx.setTransform(cv.width / PW, 0, 0, cv.width / PW, 0, 0); ctx.fillStyle = ds.c; ctx.fill(pathOf(ds)); ctx.restore(); }
            else if (ds) draw(c.key, I.bbox(ds));
          } else X.toast(t('This page is full. Start a new page.', 'Denne siden er full. Start en ny side.'));
        }
        liveClear();
      } else if (c.mode === 'erase') {
        addPts(e, c); eraseTo(c); liveClear();
        if (c.changed) commitErase(c);
      } else if (c.mode === 'lasso') {
        const poly = []; for (let i = 0; i < c.pts.length; i += 3) poly.push([c.pts[i], c.pts[i + 1]]);
        liveClear();
        if (poly.length > 4) { const d = cfg.data(c.key), strokes = d.ink.filter(s => { const st = S(s); return st && I.lassoHit(st, poly); }), ims = (d.im || []).filter(m => I.inPoly(m.x + m.w / 2, m.y + m.h / 2, poly));
          if (strokes.length || ims.length) setSel({ key: c.key, el: c.el, strokes: new Set(strokes), ims: new Set(ims.map(m => m.id)) }); }
      } else if (c.mode === 'move') endMove(c);
      unlisten();
    }
    /* the eraser changed the page as it went; undo needs the page as it was before the stroke of the eraser */
    function commitErase(c) { const now = c.ink; cfg.set(c.key, Object.assign(snapT(c.key), { ink: c.orig })); change(c.key, Object.assign(snapT(c.key), { ink: now })); draw(c.key); }
    function abort() { if (!cur) return; const c = cur; cur = null; cancelAnimationFrame(raf); raf = 0; liveClear(); if (c.mode === 'erase' && c.changed) { cfg.set(c.key, Object.assign(snapT(c.key), { ink: c.orig })); draw(c.key); } }
    function cancel(e) { if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (gest && touches.size < 1) gestEnd(); } if (cur && e.pointerId === cur.id) { if (cur.mode === 'ink' && cur.pts.length > 6) up(e); else abort(); } unlisten(); }

    /* ---------- selection (lasso) ---------- */
    const inBox = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    function selBox(s) { const d = cfg.data(s.key); let bb = null; d.ink.forEach(x => { if (s.strokes.has(x)) { const st = S(x); if (st) bb = I.union(bb, I.bbox(st)); } }); (d.im || []).forEach(m => { if (s.ims.has(m.id)) bb = I.union(bb, { x: m.x, y: m.y, w: m.w, h: m.h }); }); return bb; }
    function setSel(s) { sel = s; s.bb = selBox(s); liveOn(s.el); drawSel(0, 0); if (cfg.onSel) cfg.onSel(sel); }
    function clearSel() { if (!sel) return; const k = sel.key; sel = null; liveClear(); draw(k); if (cfg.onSel) cfg.onSel(null); }
    function drawSel(dx, dy) {
      if (!sel || !live) return; const ctx = live.getContext('2d'), d = cfg.data(sel.key);
      ctx.clearRect(0, 0, live.width, live.height); ctx.save(); ctx.setTransform(live._s, 0, 0, live._s, 0, 0);
      if (sel.moving) { ctx.translate(dx, dy); (d.im || []).forEach(m => { if (sel.ims.has(m.id)) { const el = imgEl(m.k, (cfg.imgs() || {})[m.k]); if (el) ctx.drawImage(el, m.x, m.y, m.w, m.h); } }); d.ink.forEach(x => { if (sel.strokes.has(x)) { const st = S(x); if (st) { ctx.globalAlpha = st.t === 'h' ? 0.42 : 1; ctx.fillStyle = st.c; ctx.fill(pathOf(st)); } } }); ctx.globalAlpha = 1; }
      const b = sel.bb; if (b) { ctx.setLineDash([12, 9]); ctx.strokeStyle = '#1D4E9E'; ctx.lineWidth = 3.5; ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); ctx.setLineDash([]); }
      ctx.restore();
    }
    function startMove() { sel.moving = true; liveOn(sel.el); const skip = new Set([...sel.strokes, ...[...sel.ims].map(i => 'm:' + i)]); draw(sel.key, null, { skip }); drawSel(0, 0); }
    function endMove(c) {
      const dx = Math.round(c.dx || 0), dy = Math.round(c.dy || 0); sel.moving = false;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { draw(sel.key); drawSel(0, 0); return; }
      const d = cfg.data(sel.key), ns = new Set();
      const ink = d.ink.map(x => { if (!sel.strokes.has(x)) return x; const st = S(x); const m = I.encodeStroke(I.moveStroke(st, dx, dy)); ns.add(m); return m; });
      const im = (d.im || []).map(m => sel.ims.has(m.id) ? Object.assign({}, m, { x: m.x + dx, y: m.y + dy }) : m);
      change(sel.key, Object.assign(snapT(sel.key), { ink, im }));
      sel.strokes = ns; sel.bb = selBox(sel); draw(sel.key); liveOn(sel.el); drawSel(0, 0);
    }
    function delSel() { if (!sel) return; const d = cfg.data(sel.key), s = sel; change(s.key, Object.assign(snapT(s.key), { ink: d.ink.filter(x => !s.strokes.has(x)), im: (d.im || []).filter(m => !s.ims.has(m.id)) })); clearSel(); draw(s.key); }
    function recolorSel(c, hl) { if (!sel) return; const d = cfg.data(sel.key), ns = new Set(); const ink = d.ink.map(x => { if (!sel.strokes.has(x)) return x; const st = S(x); if (!st || (st.t === 'h') !== !!hl) { ns.add(x); return x; } const m = I.encodeStroke(I.recolor(st, c)); ns.add(m); return m; }); change(sel.key, Object.assign(snapT(sel.key), { ink })); sel.strokes = ns; draw(sel.key); drawSel(0, 0); }

    /* ---------- fingers: pan with one, pinch with two (only on the page in view; elsewhere the browser scrolls) ---------- */
    function startGesture() {
      const pts = [...touches.values()]; cancelAnimationFrame(mom);
      if (pts.length >= 2) { const [a, b] = pts; gest = { two: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx0: (a.x + b.x) / 2, cy0: (a.y + b.y) / 2, sl: sc.scrollLeft, st: sc.scrollTop, s: 1 }; }
      else if (pts.length === 1) { gest = { two: false, x: pts[0].x, y: pts[0].y, vx: 0, vy: 0, t: performance.now() }; }
      listen();
    }
    function gestMove() {
      const pts = [...touches.values()];
      if (gest.two && pts.length >= 2) { const [a, b] = pts, s = Math.hypot(a.x - b.x, a.y - b.y) / gest.d0, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; gest.s = s; gest.cx = cx; gest.cy = cy; if (cfg.pinch) cfg.pinch.move(s, gest.cx0, gest.cy0, cx - gest.cx0, cy - gest.cy0); }
      else if (!gest.two && pts.length === 1) { const p = pts[0], now = performance.now(), dx = p.x - gest.x, dy = p.y - gest.y, dt = Math.max(1, now - gest.t); sc.scrollLeft -= dx; sc.scrollTop -= dy; gest.vx = dx / dt; gest.vy = dy / dt; gest.x = p.x; gest.y = p.y; gest.t = now; }
    }
    function gestEnd() {
      const g = gest; gest = null; if (!g) return;
      if (g.two) { if (cfg.pinch) cfg.pinch.end(g.s || 1, g.cx0, g.cy0, (g.cx || g.cx0) - g.cx0, (g.cy || g.cy0) - g.cy0); return; }
      let vx = g.vx * 16, vy = g.vy * 16; if (performance.now() - g.t > 80) return;
      const go = () => { vx *= 0.94; vy *= 0.94; sc.scrollLeft -= vx; sc.scrollTop -= vy; if (Math.abs(vx) + Math.abs(vy) > 0.4) mom = requestAnimationFrame(go); };
      mom = requestAnimationFrame(go);
    }
    /* Safari: a pencil touch must never scroll the page */
    function stylus(e) { for (const tt of e.changedTouches) if (tt.touchType === 'stylus' && cfg.on()) { e.preventDefault(); return; } }
    function wheel(e) { if (cfg.wheelZoom && (e.ctrlKey || e.metaKey)) { e.preventDefault(); cfg.wheelZoom(e.deltaY, e.clientX, e.clientY); } }
    sc.addEventListener('pointerdown', down, { passive: false });
    sc.addEventListener('touchstart', stylus, { passive: false }); sc.addEventListener('touchmove', stylus, { passive: false });
    sc.addEventListener('wheel', wheel, { passive: false });
    return api;
  }

  /* ---------- the tool bar (shared by notebooks and PDFs) ---------- */
  const IC = {
    pen: '<path d="M4 16l1-4 8.5-8.5 3 3L8 15z"/><path d="M12 5l3 3"/>',
    hl: '<path d="M6 13l6.5-6.5 3 3L9 16H6z"/><path d="M4 17.5h12" opacity=".5"/>',
    erase: '<path d="M8 16l-4-4 7-7 6 6-5 5z"/><path d="M8 16h8"/>',
    lasso: '<path d="M10 4c4 0 7 2 7 4.5S14 13 10 13 3 11 3 8.5 6 4 10 4z" stroke-dasharray="2.4 2"/><path d="M6 12c-1 2 0 4 2 4.5"/>',
    text: '<path d="M5 5h10M10 5v11M7.5 16h5"/>',
    image: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3.5 14l4-4 3 3 2-2 4 4"/><circle cx="13" cy="7.5" r="1.2"/>',
    undo: '<path d="M7 6L3.5 9.5 7 13"/><path d="M4 9.5h7a4.5 4.5 0 010 9H9"/>',
    redo: '<path d="M13 6l3.5 3.5L13 13"/><path d="M16 9.5H9a4.5 4.5 0 000 9h2"/>',
    hand: '<path d="M7 10V5a1.2 1.2 0 012.4 0v4.5M9.4 9V3.8a1.2 1.2 0 012.4 0V9M11.8 9V5a1.2 1.2 0 012.4 0v6c0 3.5-2 6-5 6-2.4 0-3.6-1.3-4.6-3l-2-3.4a1.2 1.2 0 012-1.3L7 10"/>',
    pages: '<rect x="3" y="3" width="6" height="8" rx=".6"/><rect x="11" y="3" width="6" height="8" rx=".6"/><path d="M3 14h14M3 17h9"/>',
    paper: '<path d="M5 3h10v14H5z"/><path d="M5 7h10M5 11h10M9 3v14"/>',
    plus: '<path d="M10 4.5v11M4.5 10h11"/>', minus: '<path d="M4.5 10h11"/>', more: '<circle cx="5" cy="10" r=".9"/><circle cx="10" cy="10" r=".9"/><circle cx="15" cy="10" r=".9"/>',
    trash: '<path d="M4.5 6h11M8 6V4h4v2M6 6l1 11h6l1-11"/>', check: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>', x: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'
  };
  const ico = k => `<svg class="i" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${IC[k]}</svg>`;
  /* o: { notebook: bool, onTool(), onUndo(), onRedo(), extra html (right side), sel } -> element */
  function toolbar(o) {
    const bar = document.createElement('div'); bar.className = 'nb-tools' + (o.notebook ? '' : ' ann'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', t('Pen', 'Penn'));
    function draw() {
      const tl = TOOLS.tool, hl = tl === 'hl', col = hl ? I.MARKERS : I.PENS, ci = hl ? TOOLS.hc : TOOLS.pc, wi = tl === 'erase' ? TOOLS.ew : hl ? TOOLS.hw : TOOLS.pw;
      const tb = (k, l) => `<button type="button" class="nb-t${tl === k ? ' on' : ''}" data-tool="${k}" aria-pressed="${tl === k}" title="${esc(l)}" aria-label="${esc(l)}">${ico(k)}</button>`;
      const showCol = tl === 'pen' || tl === 'hl' || (tl === 'lasso' && o.sel && o.sel());
      const opts = (showCol ? `<div class="nb-g nb-cols" role="group" aria-label="${esc(t('Colour', 'Farge'))}">${col.map((c, i) => `<button type="button" class="nb-c${i === ci && tl !== 'lasso' ? ' on' : ''}" data-col="${i}" style="--c:${c}" aria-label="${esc(t('Colour', 'Farge'))} ${i + 1}" aria-pressed="${i === ci}"><i></i></button>`).join('')}</div>` : '')
        + (tl === 'pen' || tl === 'hl' || tl === 'erase' ? `<div class="nb-g nb-ws" role="group" aria-label="${esc(t('Size', 'Størrelse'))}">${[0, 1, 2].map(i => `<button type="button" class="nb-w${i === wi ? ' on' : ''}" data-w="${i}" aria-label="${esc([t('Fine', 'Fin'), t('Medium', 'Middels'), t('Bold', 'Tykk')][i])}" aria-pressed="${i === wi}"><i style="--s:${[3, 6, 10][i]}px"></i></button>`).join('')}</div>` : '')
        + (tl === 'erase' ? `<div class="seg nb-em" role="group" aria-label="${esc(t('Eraser', 'Viskelær'))}"><button type="button" data-em="stroke" class="${TOOLS.em === 'stroke' ? 'on' : ''}" aria-pressed="${TOOLS.em === 'stroke'}">${esc(t('Whole line', 'Hel strek'))}</button><button type="button" data-em="part" class="${TOOLS.em === 'part' ? 'on' : ''}" aria-pressed="${TOOLS.em === 'part'}">${esc(t('Partial', 'Delvis'))}</button></div>` : '')
        + (tl === 'lasso' && o.sel && o.sel() ? `<button type="button" class="btn sm danger nb-del" data-a="del">${ico('trash')}<span>${esc(t('Delete', 'Slett'))}</span></button>` : '');
      /* two rows. The first never changes place: pen, highlighter, eraser, lasso, undo, redo (then the rest, and More
         on a narrow pane, which holds what is hidden there). The second is the tool in your hand: its colours and sizes.
         On a wide pane the two flow as one line (notebook.css). */
      bar.innerHTML = `<div class="nb-r1"><div class="nb-g">${tb('pen', t('Pen', 'Penn'))}${tb('hl', t('Highlighter', 'Merkepenn'))}${tb('erase', t('Eraser', 'Viskelær'))}${tb('lasso', t('Lasso: select, move, delete', 'Lasso: velg, flytt, slett'))}</div>${o.notebook ? `<div class="nb-g nb-x">${tb('text', t('Text box', 'Tekstboks'))}<button type="button" class="nb-t" data-a="image" title="${esc(t('Insert an image', 'Sett inn et bilde'))}" aria-label="${esc(t('Insert an image', 'Sett inn et bilde'))}">${ico('image')}</button></div>` : ''}<div class="nb-g nb-ur"><button type="button" class="nb-t" data-a="undo" title="${esc(t('Undo', 'Angre'))}" aria-label="${esc(t('Undo', 'Angre'))}"${o.canUndo && !o.canUndo() ? ' disabled' : ''}>${ico('undo')}</button><button type="button" class="nb-t" data-a="redo" title="${esc(t('Redo', 'Gjør om'))}" aria-label="${esc(t('Redo', 'Gjør om'))}"${o.canRedo && !o.canRedo() ? ' disabled' : ''}>${ico('redo')}</button></div><button type="button" class="nb-t nb-finger nb-x${TOOLS.finger ? ' on' : ''}" data-a="finger" aria-pressed="${!!TOOLS.finger}" title="${esc(penSeen ? t('A pen is in use: fingers scroll and zoom', 'En penn er i bruk: fingre blar og zoomer') : t('Draw with a finger', 'Tegn med fingeren'))}" aria-label="${esc(t('Draw with a finger', 'Tegn med fingeren'))}"${penSeen ? ' disabled' : ''}>${ico('hand')}</button><span class="sp"></span><div class="nb-ex">${o.extra ? o.extra() : ''}</div><button type="button" class="nb-t nb-more${tl === 'text' || TOOLS.finger ? ' on' : ''}" data-a="tmore" aria-haspopup="menu" title="${esc(t('More', 'Mer'))}" aria-label="${esc(t('More', 'Mer'))}">${ico('more')}</button></div>${opts ? `<div class="nb-r2">${opts}</div>` : ''}`;
    }
    const setTool = k => { TOOLS.tool = k; saveTools(); if (o.onTool) o.onTool(); draw(); };
    const setFinger = () => { TOOLS.finger = !TOOLS.finger; saveTools(); draw(); X.toast(TOOLS.finger ? t('Your finger draws now. Use two fingers to scroll.', 'Fingeren tegner nå. Bruk to fingre for å bla.') : t('Your finger scrolls now.', 'Fingeren blar nå.')); };
    /* More (narrow panes only): the tools that are not in the row, then what the owner of the bar adds (o.more) */
    function moreMenu(at) {
      const own = o.more ? o.more(at) : [];
      X.menu(at, (o.notebook ? [{ l: t('Text box', 'Tekstboks'), on: TOOLS.tool === 'text', f: () => setTool('text') }, { l: t('Insert an image', 'Sett inn et bilde'), f: () => o.onAction && o.onAction('image', at) }] : [])
        .concat([{ l: t('Draw with a finger', 'Tegn med fingeren'), on: !!TOOLS.finger, dis: penSeen, f: setFinger }], own.length ? [{ sep: 1 }] : [], own));
    }
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.tool) { setTool(b.dataset.tool); return; }
      if (b.dataset.col != null) { const i = +b.dataset.col; if (TOOLS.tool === 'lasso' && o.recolor) { o.recolor(I.PENS[i]); return; } if (TOOLS.tool === 'hl') TOOLS.hc = i; else TOOLS.pc = i; saveTools(); draw(); return; }
      if (b.dataset.w != null) { const i = +b.dataset.w; if (TOOLS.tool === 'erase') TOOLS.ew = i; else if (TOOLS.tool === 'hl') TOOLS.hw = i; else TOOLS.pw = i; saveTools(); draw(); return; }
      if (b.dataset.em) { TOOLS.em = b.dataset.em; saveTools(); draw(); return; }
      const a = b.dataset.a; if (!a) return;
      if (a === 'undo') o.onUndo(); else if (a === 'redo') o.onRedo(); else if (a === 'finger') setFinger(); else if (a === 'tmore') moreMenu(b);
      else if (o.onAction) o.onAction(a, b);
    });
    draw(); bar.redraw = draw; return bar;
  }

  /* ---------- notebook ---------- */
  const paperName = p => t.apply(null, I.PAPER_NAMES[p] || ['', '']);
  function defaultTitle() { const d = new Date(); return t('Notebook ', 'Notatbok ') + d.toLocaleDateString(X.lang() === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short' }); }
  async function create(f, opts) {
    const nb = I.newNotebook({ title: (f && f.title) || defaultTitle(), paper: (f && f.paper) || 'grid' });
    await X.A.commit(nb); return X.openItem('notebook', nb.id, opts || {});
  }
  /* where the account keeps it: dot class and a short text */
  function keptState(id) {
    const A = X.A, u = window.BBACCOUNT && window.BBACCOUNT.user, full = A.M.sync && A.M.sync.full, left = full ? Object.values(full).some(x => (x.leftOut || []).includes(id)) : false;
    if (!u) return { c: 'dev', s: t('On this device', 'På denne enheten'), title: t('Not signed in. Kept on this device only.', 'Ikke logget inn. Lagres bare på denne enheten.') };
    if (left) return { c: 'warn', s: t('Only on this device', 'Bare på denne enheten'), title: t('Too large for the free account space. It stays on this device and in your backup file.', 'For stor for den gratis kontoplassen. Den blir på denne enheten og i sikkerhetskopien.') };
    return { c: 'acc', s: t('Saved', 'Lagret'), title: t('Saved on this device and synced to your account.', 'Lagret på denne enheten og synkronisert med kontoen din.') };
  }

  function mountNotebook(box, tab, ctx) {
    const A = X.A, W = A.W, id = tab.r;
    let item = A.item(id);
    if (!W.isLive(item) || item.kind !== 'notebook') return X.missing(box, 'notebook', id, ctx);
    let nb = I.cleanNotebook(item); const openPages = item.pages, openAt = item.updatedAt;
    let alive = true, z = (ctx.st && ctx.st.z) || 1, curP = Math.max(0, ((ctx.st && ctx.st.p) || 1) - 1), pageEls = [], painted = [], obs = null, ro = null, lastW = 0, saveT = 0, dirty = false, lastSaved = item.updatedAt, rafS = 0, posT = 0, thumbT = {};
    const root = X.h('div', 'nb'); box.appendChild(root);
    const showThumbs = () => !!(A.M.nbThumbs == null ? !X.isPhone() : A.M.nbThumbs);
    root.innerHTML = `<div class="nb-top"></div><div class="nb-body"><aside class="nb-th" aria-label="${esc(t('Pages', 'Sider'))}"></aside><div class="nb-sc" tabindex="0" data-keep-scroll><div class="nb-pages"></div></div></div><input type="file" accept="image/*" hidden>`;
    const top = root.querySelector('.nb-top'), th = root.querySelector('.nb-th'), sc = root.querySelector('.nb-sc'), wrap = root.querySelector('.nb-pages'), fileIn = root.querySelector('input[type=file]');
    const hOf = () => I.PH;
    const pageW = () => { const w = sc.clientWidth || 600; return Math.max(200, Math.round(Math.min(w - (X.isPhone() ? 16 : 40), 880) * z)); };
    const idxOf = key => nb.pages.findIndex(p => p.id === key);

    /* --- data for the ink engine --- */
    const ink = Ink({
      sc, kind: 'nb', sel: '.nb-pg', bg: true,
      keyOf: el => el.dataset.id, elOf: key => pageEls[idxOf(key)] || null,
      canvasOf: key => { const el = pageEls[idxOf(key)]; return el ? el.querySelector('canvas.base') : null; },
      hOf, paperOf: key => I.paperOf(nb, nb.pages[idxOf(key)]), imgs: () => nb.imgs,
      data: key => nb.pages[idxOf(key)] || { ink: [], im: [], tx: [] },
      set: (key, d) => { const i = idxOf(key); if (i < 0) return; const pages = nb.pages.slice(); pages[i] = Object.assign({}, pages[i], { ink: d.ink, im: d.im || pages[i].im, tx: d.tx || pages[i].tx }); nb = Object.assign({}, nb, { pages }); touched(i); drawTexts(i); },
      on: () => true,
      onTap: (key, x, y) => addText(idxOf(key), x, y),
      onSel: () => tools.redraw(), onHist: () => tools.redraw(), onPen: () => tools.redraw(),
      pinch: { move: (s, cx, cy, dx, dy) => preview(s, cx, cy, dx, dy), end: (s, cx, cy, dx, dy) => { wrap.style.transform = ''; if (Math.abs(s - 1) < 0.03) { sc.scrollLeft -= dx; sc.scrollTop -= dy; } else zoomTo(z * s, cx + dx, cy + dy, cx, cy); } },
      wheelZoom: (dy, cx, cy) => zoomTo(z * (dy < 0 ? 1.1 : 1 / 1.1), cx, cy)
    });
    const tools = toolbar({ notebook: true, sel: () => ink.sel, canUndo: ink.canUndo, canRedo: ink.canRedo, onUndo: () => ink.undo(), onRedo: () => ink.redo(), recolor: c => ink.recolorSel(c),
      onTool: () => { ink.clearSel(); root.classList.toggle('texting', TOOLS.tool === 'text'); },
      onAction: (a) => { if (a === 'del') ink.delSel(); else if (a === 'image') fileIn.click(); },
      more: at => [{ l: t('Paper…', 'Papir …'), f: () => paperMenu(at, curP) }].concat(moreItems(at)),
      extra: () => `<span class="nb-st" title=""></span><div class="dv-zoom nb-zoom"><button type="button" class="dk-ib" data-a="zout" aria-label="${esc(t('Zoom out', 'Zoom ut'))}">${ico('minus')}</button><button type="button" class="dv-z" data-a="zfit" title="${esc(t('Fit to width', 'Tilpass bredden'))}">${Math.round(z * 100)}%</button><button type="button" class="dk-ib" data-a="zin" aria-label="${esc(t('Zoom in', 'Zoom inn'))}">${ico('plus')}</button></div>
        <button type="button" class="dk-ib nb-wide" data-a="paper" aria-haspopup="menu" title="${esc(t('Paper', 'Papir'))}" aria-label="${esc(t('Paper', 'Papir'))}">${ico('paper')}</button><button type="button" class="dk-ib nb-wide${showThumbs() ? ' on' : ''}" data-a="thumbs" aria-pressed="${showThumbs()}" title="${esc(t('Pages', 'Sider'))}" aria-label="${esc(t('Show page thumbnails', 'Vis sideminiatyrer'))}">${ico('pages')}</button><button type="button" class="dk-ib nb-wide" data-a="more" aria-haspopup="menu" title="${esc(t('More', 'Mer'))}" aria-label="${esc(t('More', 'Mer'))}">${ico('more')}</button>` });
    top.appendChild(tools);
    root.classList.toggle('texting', TOOLS.tool === 'text');
    tools.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'zin') zoomTo(z * 1.25); else if (a === 'zout') zoomTo(z / 1.25); else if (a === 'zfit') zoomTo(1);
      else if (a === 'paper') paperMenu(b, curP);
      else if (a === 'thumbs') { A.M.nbThumbs = !showThumbs(); A.saveMeta(); drawThumbs(true); tools.redraw(); status(); }
      else if (a === 'more') moreMenu(b);
    });
    function status() { const s = tools.querySelector('.nb-st'); if (!s) return; const k = keptState(id); s.title = k.title; s.innerHTML = `<i class="kept ${k.c}"></i><span>${esc(dirty ? t('Saving…', 'Lagrer …') : k.s)}</span>`; }

    /* --- pages --- */
    function build() {
      wrap.innerHTML = nb.pages.map((p, i) => `<div class="nb-pg" data-id="${esc(p.id)}" data-i="${i}"><canvas class="base"></canvas><div class="nb-tx"></div><span class="no">${i + 1}</span></div>`).join('') + `<button type="button" class="nb-addpg" data-a="add">${ico('plus')}<span>${esc(t('Add page', 'Legg til side'))}</span></button>`;
      pageEls = [...wrap.querySelectorAll('.nb-pg')]; painted = [];
      if (obs) obs.disconnect();
      obs = new IntersectionObserver(es => es.forEach(e => { e.target._vis = e.isIntersecting; if (e.isIntersecting) paintEl(e.target); }), { root: sc, rootMargin: '600px 0px' });
      pageEls.forEach(el => obs.observe(el));
      size(); pageEls.forEach((el, i) => drawTexts(i));
    }
    function size() {
      const w = pageW(); lastW = sc.clientWidth; wrap.style.width = w + 'px';
      pageEls.forEach(el => { el.style.height = Math.round(w * hOf() / PW) + 'px'; el.style.setProperty('--u', (w / PW).toFixed(5)); });
    }
    function paintEl(el) {
      const i = +el.dataset.i, p = nb.pages[i]; if (!p) return;
      const w = pageW(), hpx = w * hOf() / PW; let d = dprCap(); while (w * d * hpx * d > 7e6 && d > 0.6) d -= 0.2;
      const cv = el.querySelector('canvas.base'), W2 = Math.round(w * d), H2 = Math.round(hpx * d);
      if (cv.width === W2 && cv.height === H2 && el._ok) return;
      cv.width = W2; cv.height = H2; el._ok = true;
      ink.draw(p.id);
      const k = painted.indexOf(el); if (k >= 0) painted.splice(k, 1); painted.push(el);
      while (painted.length > 8) { const o = painted.shift(); if (o._vis) { painted.push(o); if (painted.filter(x => !x._vis).length === 0) break; continue; } const oc = o.querySelector('canvas.base'); oc.width = oc.height = 0; o._ok = false; }
    }
    function repaint(i) { const el = pageEls[i]; if (!el) return; el._ok = false; if (el._vis) paintEl(el); }
    function touched(i) { dirty = true; status(); clearTimeout(saveT); saveT = setTimeout(flush, 700); thumbSoon(i); }
    function flush(force) {
      clearTimeout(saveT); saveT = 0; if (!alive && !force) return;
      const cur = A.item(id); if (!cur || !W.isLive(cur)) return;
      const next = I.saveNotebook(cur, Object.assign({}, cur, { title: nb.title, paper: nb.paper, pages: nb.pages, imgs: nb.imgs }), Date.now(), !!force);
      if (JSON.stringify(next.pages) === JSON.stringify(cur.pages) && next.title === cur.title && next.paper === cur.paper) { dirty = false; status(); return; }
      lastSaved = next.updatedAt; nb = Object.assign({}, nb, { versions: next.versions, imgs: next.imgs }); dirty = false;
      A.commit(next, { wait: 15000 }); status();
    }
    /* --- where the reader is --- */
    function where() { const y = sc.scrollTop + sc.clientHeight * 0.35; let lo = 0, hi = pageEls.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pageEls[m].offsetTop <= y) lo = m; else hi = m - 1; } const e = pageEls[lo]; return { i: lo, o: e ? Math.max(0, Math.min(1, (sc.scrollTop + 12 - e.offsetTop) / e.offsetHeight)) : 0 }; }
    function goPage(i, o, flash) {
      i = Math.max(0, Math.min(nb.pages.length - 1, i)); const el = pageEls[i]; if (!el) return;
      sc.scrollTop = Math.max(0, el.offsetTop - 12 + (o || 0) * el.offsetHeight); setCur(i);
      if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    }
    function setCur(i) { if (curP !== i || !pageEls[i] || !pageEls[i].classList.contains('act')) { curP = i; ink.active(nb.pages[i] && nb.pages[i].id); th.querySelectorAll('.nb-tb').forEach(b => b.classList.toggle('on', +b.dataset.i === i)); const on = th.querySelector('.nb-tb.on'); if (on && (on.offsetTop < th.scrollTop || on.offsetTop + on.offsetHeight > th.scrollTop + th.clientHeight)) th.scrollTop = on.offsetTop - 20; } }
    function onScroll() { if (rafS) return; rafS = requestAnimationFrame(() => { rafS = 0; if (!alive) return; setCur(where().i); clearTimeout(posT); posT = setTimeout(savePos, 500); }); }
    function savePos() { if (!alive) return; const w = where(); const s = { p: w.i + 1, o: w.o, z }; ctx.setSt(s); return s; }
    /* --- zoom: pinch shows a preview; the pages are drawn again at the new size when the fingers lift --- */
    function preview(s, cx, cy, dx, dy) { const r = wrap.getBoundingClientRect(); wrap.style.transformOrigin = (cx - r.left) + 'px ' + (cy - r.top) + 'px'; wrap.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; }
    function zoomTo(nz, cx, cy, ox, oy) {
      nz = Math.max(0.5, Math.min(4, nz)); if (Math.abs(nz - z) < 0.005) { return; }
      const r = sc.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
      if (ox == null) { ox = cx; oy = cy; }
      const px = ox - wr.left, py = oy - wr.top, k = nz / z;
      z = nz; size(); pageEls.forEach(el => { el._ok = false; });
      sc.scrollLeft = Math.max(0, wrap.offsetLeft + px * k - (cx - r.left)); sc.scrollTop = Math.max(0, wrap.offsetTop + py * k - (cy - r.top));
      pageEls.forEach(el => { if (el._vis) paintEl(el); }); pageEls.forEach((el, i) => drawTexts(i));
      root.classList.toggle('zoomed', z > 1.01);
      const zb = tools.querySelector('.dv-z'); if (zb) zb.textContent = Math.round(z * 100) + '%';
      requestAnimationFrame(() => pageEls.forEach(el => { if (el._vis) paintEl(el); }));
      savePos();
    }
    /* --- text boxes --- */
    function drawTexts(i) {
      const el = pageEls[i], p = nb.pages[i]; if (!el || !p) return; const layer = el.querySelector('.nb-tx'), a = document.activeElement;
      const have = new Map([...layer.children].map(c => [c.dataset.id, c]));
      (p.tx || []).forEach(b => {
        let d = have.get(b.id); have.delete(b.id);
        if (!d) { d = document.createElement('div'); d.className = 'tb'; d.dataset.id = b.id; d.innerHTML = `<span class="grip" aria-hidden="true"></span><div class="tx" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(t('Text box', 'Tekstboks'))}" spellcheck="true"></div><button type="button" class="x" aria-label="${esc(t('Delete text box', 'Slett tekstboksen'))}">${ico('x')}</button>`; layer.appendChild(d); }
        d.style.left = (b.x / PW * 100) + '%'; d.style.top = (b.y / hOf() * 100) + '%'; d.style.width = (b.w / PW * 100) + '%'; d.style.setProperty('--fs', b.fs); d.style.color = b.c || '';
        const tx = d.querySelector('.tx'); if (!(a && d.contains(a)) && tx.innerText !== b.s) tx.innerText = b.s;
      });
      have.forEach(d => { if (!(a && d.contains(a))) d.remove(); });
    }
    function addText(i, x, y) {
      const p = nb.pages[i]; if (!p) return; const b = { id: I.uid('t'), x: Math.max(0, Math.min(PW - 300, x - 20)), y: Math.max(0, y - 30), w: Math.min(900, PW - x + 20), fs: 44, c: I.PENS[TOOLS.pc] || '#1B2430', s: '' };
      ink.change(p.id, { ink: p.ink, im: p.im, tx: (p.tx || []).concat([b]) });
      drawTexts(i); const d = pageEls[i].querySelector(`.tb[data-id="${b.id}"] .tx`); if (d) d.focus();
    }
    let txT = 0;
    wrap.addEventListener('input', e => { const tx = e.target.closest('.tb .tx'); if (!tx) return; clearTimeout(txT); txT = setTimeout(() => saveText(tx), 400); });
    function saveText(tx, undoable) {
      const d = tx.closest('.tb'), el = tx.closest('.nb-pg'); if (!d || !el) return; const i = +el.dataset.i, p = nb.pages[i]; if (!p) return;
      const s = tx.innerText.replace(/\n$/, '').slice(0, 4000), list = (p.tx || []).map(b => b.id === d.dataset.id ? Object.assign({}, b, { s }) : b);
      if (undoable) ink.change(p.id, { ink: p.ink, im: p.im, tx: list }); else { const pages = nb.pages.slice(); pages[i] = Object.assign({}, p, { tx: list }); nb = Object.assign({}, nb, { pages }); touched(i); }
    }
    wrap.addEventListener('focusout', e => { const tx = e.target.closest && e.target.closest('.tb .tx'); if (!tx) return; clearTimeout(txT); const d = tx.closest('.tb'), el = tx.closest('.nb-pg'), i = +el.dataset.i, p = nb.pages[i];
      if (!tx.innerText.trim() && p) { ink.change(p.id, { ink: p.ink, im: p.im, tx: (p.tx || []).filter(b => b.id !== d.dataset.id) }); d.remove(); } else saveText(tx); });
    wrap.addEventListener('keydown', e => { if (e.target.closest('.tb')) e.stopPropagation(); }, true);
    wrap.addEventListener('click', e => {
      const x = e.target.closest('.tb .x'); if (x) { const d = x.closest('.tb'), el = x.closest('.nb-pg'), p = nb.pages[+el.dataset.i]; ink.change(p.id, { ink: p.ink, im: p.im, tx: (p.tx || []).filter(b => b.id !== d.dataset.id) }); d.remove(); return; }
      const add = e.target.closest('[data-a="add"]'); if (add) addPage(nb.pages.length);
    });
    /* move a text box by its grip */
    wrap.addEventListener('pointerdown', e => {
      const g = e.target.closest('.tb .grip'); if (!g) return; e.preventDefault(); e.stopPropagation();
      const d = g.closest('.tb'), el = g.closest('.nb-pg'), i = +el.dataset.i, p = nb.pages[i], b = (p.tx || []).find(x => x.id === d.dataset.id); if (!b) return;
      const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let nx = b.x, ny = b.y;
      const mv = ev => { nx = Math.max(0, Math.min(PW - 200, b.x + (ev.clientX - x0) / r.width * PW)); ny = Math.max(0, Math.min(hOf() - 60, b.y + (ev.clientY - y0) / r.height * hOf())); d.style.left = (nx / PW * 100) + '%'; d.style.top = (ny / hOf() * 100) + '%'; };
      const upx = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upx); if (nx !== b.x || ny !== b.y) ink.change(p.id, { ink: p.ink, im: p.im, tx: (p.tx || []).map(x => x.id === b.id ? Object.assign({}, x, { x: Math.round(nx), y: Math.round(ny) }) : x) }); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upx);
    }, true);
    /* --- images --- */
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; fileIn.value = ''; if (!f) return;
      try {
        const url = await downscale(f, 1400), k = I.uid('img'), im = await loadImg(url), p = nb.pages[curP];
        const w = 1300, hh = Math.round(w * im.naturalHeight / Math.max(1, im.naturalWidth)), el = pageEls[curP], y = Math.max(80, Math.min(hOf() - hh - 80, (sc.scrollTop + 60 - el.offsetTop) / el.offsetHeight * hOf()));
        nb = Object.assign({}, nb, { imgs: Object.assign({}, nb.imgs, { [k]: url }) });
        ink.change(p.id, { ink: p.ink, im: (p.im || []).concat([{ id: I.uid('m'), k, x: Math.round((PW - w) / 2), y: Math.round(y), w, h: hh }]), tx: p.tx });
        repaint(curP); X.toast(t('Image added. Use the lasso to move it.', 'Bildet er lagt til. Bruk lassoen for å flytte det.'));
      } catch (er) { X.toast(t('This image could not be added.', 'Dette bildet kunne ikke legges til.')); }
    });
    /* --- page operations --- */
    function rebuild(keepI) { const y = sc.scrollTop; build(); drawThumbs(true); sc.scrollTop = y; if (keepI != null) goPage(keepI); else setCur(where().i); touchedAll(); }
    function touchedAll() { dirty = true; status(); clearTimeout(saveT); saveT = setTimeout(flush, 500); }
    function addPage(at, paper) { if (nb.pages.length >= I.MAX_PAGES) return; nb = I.addPage(nb, at, paper); rebuild(at); }
    function dupPage(i) { nb = I.duplicatePage(nb, i); rebuild(i + 1); }
    function delPage(i) {
      const before = nb; nb = I.deletePage(nb, i); rebuild(Math.min(i, nb.pages.length - 1));
      A.toast(t('Page deleted.', 'Siden er slettet.'), [t('Undo', 'Angre'), () => { if (!alive) return; nb = Object.assign({}, nb, { pages: before.pages }); rebuild(i); }]);
    }
    function movePg(i, to) { nb = I.movePage(nb, i, to); rebuild(Math.max(0, Math.min(nb.pages.length - 1, to))); }
    function setPaper(i, paper, all) { nb = I.setPaper(nb, i, paper, all); if (i == null) pageEls.forEach((el, k) => repaint(k)); else repaint(i); drawThumbs(true); touchedAll(); }
    function paperMenu(at, i) {
      const cur = I.paperOf(nb, nb.pages[i]);
      X.menu(at, [{ l: t('This page', 'Denne siden'), dis: 1 }].concat(I.PAPERS.map(p => ({ l: paperName(p), on: p === cur, f: () => setPaper(i, p) })), [{ sep: 1 }, { l: t('Every page in this notebook', 'Alle sidene i notatboken'), dis: 1 }], I.PAPERS.map(p => ({ l: paperName(p), on: p === nb.paper && !nb.pages.some(x => x.paper && x.paper !== p), f: () => setPaper(null, p, true) }))), true);
    }
    function pageMenu(at, i) {
      X.menu(at, [
        { l: t('Add a page after this one', 'Legg til en side etter denne'), f: () => addPage(i + 1) },
        { l: t('Duplicate page', 'Dupliser siden'), f: () => dupPage(i) },
        { l: t('Paper…', 'Papir …'), f: () => paperMenu(at, i) },
        { l: t('Move up', 'Flytt opp'), f: () => movePg(i, i - 1), dis: i === 0 },
        { l: t('Move down', 'Flytt ned'), f: () => movePg(i, i + 1), dis: i >= nb.pages.length - 1 },
        { l: t('Export this page as PNG', 'Eksporter siden som PNG'), f: () => exportPng(i) },
        { sep: 1 }, { l: t('Delete page', 'Slett siden'), f: () => delPage(i), danger: 1 }]);
    }
    const moreMenu = at => X.menu(at, moreItems(at));
    function moreItems(at) {
      return [
        { l: t('Rename…', 'Gi nytt navn …'), f: rename },
        { l: t('Add page', 'Legg til side'), f: () => addPage(curP + 1) },
        { l: t('Page options…', 'Valg for siden …'), f: () => pageMenu(at, curP) },
        { sep: 1 },
        { l: t('Export as PDF', 'Eksporter som PDF'), f: () => exportPdf() },
        { l: t('Export this page as PNG', 'Eksporter siden som PNG'), f: () => exportPng(curP) },
        { l: t('History…', 'Historikk …'), f: history },
        { sep: 1 }, { l: t('Move to trash', 'Flytt til papirkurv'), f: () => { flush(true); A.doTrash(id); if (ctx && ctx.close) ctx.close(); }, danger: 1 }];
    }
    async function rename() {
      const v = await A.openDlg(`<h3 id="wsDlgH">${esc(t('Rename notebook', 'Gi notatboken nytt navn'))}</h3><form id="nbNameF" novalidate><div class="fld"><label for="nbName">${esc(t('Name', 'Navn'))}</label><input id="nbName" maxlength="120" value="${esc(nb.title)}" autofocus></div><div class="foot"><button type="button" class="btn" data-close>${esc(t('Cancel', 'Avbryt'))}</button><button type="submit" class="btn pri">${esc(t('Save', 'Lagre'))}</button></div></form>`,
        close => { document.getElementById('nbNameF').onsubmit = e => { e.preventDefault(); const s = document.getElementById('nbName').value.replace(/\s+/g, ' ').trim(); if (s) close(s); }; });
      if (!v || !alive) return; nb = Object.assign({}, nb, { title: v.slice(0, 120) }); flush(); X.drawTabTitles();
    }
    function history() {
      flush(); const cur = A.item(id), vs = ((cur && cur.versions) || []).slice().reverse();
      A.openDlg(`<h3 id="wsDlgH">${esc(t('Notebook history', 'Historikk for notatboken'))}</h3>${vs.length ? `<p>${esc(t('A copy of the pages is kept while you write (at most every ten minutes) and when you close the notebook. Restoring keeps the current pages as a new version.', 'En kopi av sidene tas vare på mens du skriver (høyst hvert tiende minutt) og når du lukker notatboken. Når du gjenoppretter, tas de nåværende sidene vare på som en ny versjon.'))}</p><ul class="vers">${vs.map(v => `<li><span><span class="w">${esc(A.dayClock(v.at))}</span><small>${v.conflict ? `<span class="cf">${esc(t('From another device', 'Fra en annen enhet'))}</span> · ` : ''}${A.plural(v.pages.length, 'page', 'pages', 'side', 'sider')} · ${A.plural(v.pages.reduce((a, p) => a + p.ink.length, 0), 'stroke', 'strokes', 'strek', 'streker')}</small></span><button type="button" class="lk" data-ver="${v.at}">${esc(t('Restore', 'Gjenopprett'))}</button></li>`).join('')}</ul>` : `<p>${esc(t('Earlier versions appear here as you keep writing.', 'Tidligere versjoner dukker opp her etter hvert som du skriver.'))}</p>`}<div class="foot"><button type="button" class="btn" data-close>${esc(t('Close', 'Lukk'))}</button></div>`,
        close => { document.querySelectorAll('#wsDlg [data-ver]').forEach(b => { b.onclick = () => close(+b.dataset.ver); }); })
        .then(at => { if (!at || !alive) return; const r = I.restoreVersion(A.item(id), at); A.commit(r); nb = I.cleanNotebook(r); lastSaved = r.updatedAt; rebuild(0); A.toast(t('Version restored.', 'Versjonen er gjenopprettet.')); });
    }
    /* --- thumbnails --- */
    let thObs = null;
    function drawThumbs(force) {
      const on = showThumbs(); root.classList.toggle('thumbs', on); th.hidden = !on; if (!on) { if (thObs) thObs.disconnect(); th.innerHTML = ''; return; }
      if (!force && th.children.length === nb.pages.length + 1) return;
      th.innerHTML = nb.pages.map((p, i) => `<div class="nb-tb${i === curP ? ' on' : ''}" data-i="${i}"><button type="button" class="pv" data-go="${i}" aria-label="${esc(t('Page ', 'Side ') + (i + 1))}"><canvas width="0" height="0"></canvas></button><span class="n">${i + 1}${p.paper && p.paper !== nb.paper ? ' · ' + esc(paperName(p.paper)) : ''}</span><button type="button" class="dk-ib m" data-pm="${i}" aria-haspopup="menu" aria-label="${esc(t('Page options', 'Valg for siden'))}">${ico('more')}</button></div>`).join('') + `<button type="button" class="nb-tadd" data-add="1">${ico('plus')}<span>${esc(t('Page', 'Side'))}</span></button>`;
      if (thObs) thObs.disconnect();
      thObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) thumb(+e.target.dataset.i); }), { root: th, rootMargin: '200px 0px' });
      th.querySelectorAll('.nb-tb').forEach(x => thObs.observe(x));
    }
    function thumb(i) { const b = th.querySelector(`.nb-tb[data-i="${i}"] canvas`), p = nb.pages[i]; if (!b || !p) return; const w = 76 * dprCap(), hh = Math.round(w * hOf() / PW); b.width = Math.round(w); b.height = hh; paint(b.getContext('2d'), { scale: w / PW, h: hOf(), bg: true, paper: I.paperOf(nb, p), ink: p.ink, im: p.im, imgs: nb.imgs, tx: p.tx, onImg: () => thumb(i) }); }
    function thumbSoon(i) { if (!showThumbs()) return; clearTimeout(thumbT[i]); thumbT[i] = setTimeout(() => { if (alive) thumb(i); }, 900); }
    th.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { goPage(+g.dataset.go, 0, true); return; } const m = e.target.closest('[data-pm]'); if (m) { pageMenu(m, +m.dataset.pm); return; } if (e.target.closest('[data-add]')) addPage(nb.pages.length); });
    /* --- export --- */
    function renderPage(i, w) { const p = nb.pages[i], hh = Math.round(w * hOf() / PW), c = document.createElement('canvas'); c.width = w; c.height = hh; paint(c.getContext('2d'), { scale: w / PW, h: hOf(), bg: true, paper: I.paperOf(nb, p), ink: p.ink, im: p.im, imgs: nb.imgs, tx: p.tx }); return c; }
    const fname = ext => (nb.title || t('Notebook', 'Notatbok')).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) + ext;
    async function exportPng(i) { await imgsReady(); const c = renderPage(i, 1654); c.toBlob(b => { if (b) A.download(b, fname(' p' + (i + 1) + '.png')); c.width = c.height = 0; }, 'image/png'); }
    async function exportPdf() {
      A.toast(t('Making the PDF…', 'Lager PDF-en …')); await imgsReady();
      const out = [];
      for (let i = 0; i < nb.pages.length; i++) { const c = renderPage(i, 1240), jpeg = await jpegOf(c); out.push({ jpeg, w: c.width, h: c.height, pw: 595.28, ph: 841.89 }); c.width = c.height = 0; await new Promise(r => setTimeout(r, 0)); }
      A.download(new Blob([I.pdfFromJpegs(out, { title: nb.title })], { type: 'application/pdf' }), fname('.pdf'));
      A.toast(t('PDF saved to your downloads.', 'PDF-en er lagret i nedlastinger.'));
    }
    const imgsReady = () => Promise.all(Object.keys(nb.imgs || {}).map(k => new Promise(r => { const el = imgEl(k, nb.imgs[k], r); if (el) r(); setTimeout(r, 3000); })));

    /* --- events --- */
    sc.addEventListener('scroll', onScroll, { passive: true });
    ro = new ResizeObserver(() => { if (!alive || Math.abs(sc.clientWidth - lastW) < 3) return; const w = where(); size(); pageEls.forEach(el => { el._ok = false; if (el._vis) paintEl(el); }); goPage(w.i, w.o); });
    ro.observe(sc);
    root.addEventListener('keydown', e => {
      if (e.target.closest('.tb') || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) ink.redo(); else ink.undo(); }
      else if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); ink.redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ink.sel) { e.preventDefault(); ink.delSel(); }
      else if (e.key === 'Escape' && ink.sel) ink.clearSel();
    });
    sc.addEventListener('gesturestart', e => e.preventDefault());
    build(); drawThumbs(true); root.classList.toggle('zoomed', z > 1.01); status();
    requestAnimationFrame(() => { if (!alive) return; size(); goPage(curP, (ctx.st && ctx.st.o) || 0); setCur(curP); });
    A.visit && A.visit('notebook', id);

    return {
      save: () => { flush(); return savePos(); },
      goPage: (p, o, fl) => goPage((+p || 1) - 1, o || 0, fl),
      refresh() {
        const it = A.item(id); if (!W.isLive(it)) return 'remount';
        status();
        if (it.updatedAt !== lastSaved && !dirty && !document.activeElement.closest('.nb .tb')) { lastSaved = it.updatedAt; const y = sc.scrollTop; nb = I.cleanNotebook(it); build(); drawThumbs(true); sc.scrollTop = y; setCur(where().i); }
      },
      destroy() {
        flush(true);
        const it = A.item(id); if (it && W.isLive(it)) { const c = I.closeSession(it, openPages, openAt, Date.now()); if (c !== it) A.commit(c, { wait: 15000 }); }
        alive = false; ink.destroy(); if (obs) obs.disconnect(); if (thObs) thObs.disconnect(); if (ro) ro.disconnect(); cancelAnimationFrame(rafS);
        pageEls.forEach(el => { const c = el.querySelector('canvas.base'); if (c) c.width = c.height = 0; });
      }
    };
  }
  function downscale(file, max) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.82)); c.width = c.height = 0; }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; im.src = u; });
  }
  const loadImg = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  const jpegOf = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/jpeg', 0.86));

  /* ---------- ink on a PDF: an overlay per page, stored apart from the file ---------- */
  /* o: { docId, sc, root, bar (insert the tools after this), pages() -> page elements, ratio(pg), cur() -> page number, zoom(z) } */
  function annotator(o) {
    const A = X.A, W = A.W, key = I.docInkId(o.docId);
    let on = false, data = I.cleanDocInk(A.item(key)) || null, saveT = 0, tools = null, eng = null;
    const pagesOf = () => (data && data.pages) || {};
    const has = p => (pagesOf()[p] || []).length > 0;
    const elOf = p => o.pages()[p - 1] || null;
    const hOf = p => { const el = elOf(p); return Math.round(PW * ((el && el._r) || o.ratio())); };
    function canvasFor(pg, make) {
      let c = pg.querySelector('canvas.inkc'); if (c || !make) return c;
      c = document.createElement('canvas'); c.className = 'inkc'; pg.appendChild(c); return c;
    }
    /* draw the ink of one page (after the PDF page itself is drawn) */
    function paintPage(pg) {
      const p = +pg.dataset.p; if (!has(p) && !on) { const c = canvasFor(pg, false); if (c) { c.width = c.height = 0; c.remove(); } return; }
      const c = canvasFor(pg, true), w = pg.clientWidth, hh = pg.clientHeight; let d = dprCap(); while (w * d * hh * d > 6e6 && d > 0.6) d -= 0.2;
      const W2 = Math.round(w * d), H2 = Math.round(hh * d); if (c.width !== W2 || c.height !== H2) { c.width = W2; c.height = H2; }
      paint(c.getContext('2d'), { scale: W2 / PW, h: hOf(p), bg: false, ink: pagesOf()[p] || [] });
    }
    function save() { clearTimeout(saveT); saveT = setTimeout(flush, 700); }
    function flush() {
      clearTimeout(saveT); saveT = 0; if (!data) return; const cur = A.item(key);
      if (cur && !cur.gone && JSON.stringify(cur.pages) === JSON.stringify(data.pages)) return;
      const it = cur && !cur.gone ? W.patch(cur, { pages: data.pages, doc: o.docId }) : Object.assign(I.newDocInk(o.docId), { pages: data.pages });
      data = it; A.commit(it, { wait: 15000 });
    }
    function engine() {
      if (eng) return eng;
      eng = Ink({ sc: o.sc, kind: 'pdf', sel: '.pg', bg: false,
        keyOf: el => +el.dataset.p, elOf, hOf,
        canvasOf: p => { const el = elOf(p); return el ? canvasFor(el, on) : null; },
        data: p => ({ ink: pagesOf()[p] || [], im: [], tx: [] }),
        set: (p, d) => { data = data || I.newDocInk(o.docId); const pages = Object.assign({}, data.pages); if (d.ink && d.ink.length) pages[p] = d.ink; else delete pages[p]; data = Object.assign({}, data, { pages }); save(); },
        on: () => on, onSel: () => tools && tools.redraw(), onHist: () => tools && tools.redraw(), onPen: () => tools && tools.redraw(),
        pinch: o.zoom ? { move: (s, cx, cy, dx, dy) => { const w = o.sc.firstElementChild; if (!w) return; const r = w.getBoundingClientRect(); w.style.transformOrigin = (cx - r.left) + 'px ' + (cy - r.top) + 'px'; w.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; }, end: (s, cx, cy, dx, dy) => { const w = o.sc.firstElementChild; if (w) w.style.transform = ''; if (Math.abs(s - 1) < 0.03) { o.sc.scrollLeft -= dx; o.sc.scrollTop -= dy; } else o.zoom(s); } } : null });
      return eng;
    }
    function toggle(v) {
      on = v == null ? !on : !!v; o.root.classList.toggle('annotating', on);
      if (on) {
        engine(); if (TOOLS.tool === 'text') TOOLS.tool = 'pen';
        tools = toolbar({ notebook: false, sel: () => eng.sel, canUndo: eng.canUndo, canRedo: eng.canRedo, onUndo: () => eng.undo(), onRedo: () => eng.redo(), recolor: c => eng.recolorSel(c), onTool: () => eng.clearSel(),
          onAction: a => { if (a === 'del') eng.delSel(); else if (a === 'done') toggle(false); },
          extra: () => `<span class="nb-st ann-note">${esc(t('The PDF itself is never changed', 'Selve PDF-en endres aldri'))}</span><button type="button" class="btn sm pri" data-a="done">${ico('check')}<span>${esc(t('Done', 'Ferdig'))}</span></button>` });
        o.bar.after(tools);
        eng.active(o.cur());
      } else { if (eng) { eng.clearSel(); eng.active(null); } if (tools) { tools.remove(); tools = null; } flush(); }
      o.pages().forEach(pg => { if (pg.querySelector('canvas.pdfc') || pg.querySelector('canvas.inkc')) paintPage(pg); });
      if (o.onToggle) o.onToggle(on);
    }
    /* the whole PDF with its ink, as a new PDF of page pictures (the original file is untouched) */
    async function exportPdf(pdf, name) {
      A.toast(t('Making the PDF with your ink…', 'Lager PDF-en med blekket ditt …')); const out = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const pg = await pdf.getPage(p), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2.2, 1240 / v0.width) });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        if (has(p)) { const ic = document.createElement('canvas'); ic.width = c.width; ic.height = c.height; paint(ic.getContext('2d'), { scale: c.width / PW, h: Math.round(PW * v0.height / v0.width), bg: false, ink: pagesOf()[p] }); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(ic, 0, 0); ic.width = ic.height = 0; }
        out.push({ jpeg: await jpegOf(c), w: c.width, h: c.height, pw: v0.width, ph: v0.height }); c.width = c.height = 0; pg.cleanup();
      }
      A.download(new Blob([I.pdfFromJpegs(out, { title: name })], { type: 'application/pdf' }), String(name || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) + t(' (with ink).pdf', ' (med blekk).pdf'));
      A.toast(t('PDF saved to your downloads.', 'PDF-en er lagret i nedlastinger.'));
    }
    return {
      paint: paintPage, toggle, get on() { return on; }, any: () => Object.keys(pagesOf()).length > 0, exportPdf,
      page(p) { if (on && eng) eng.active(p); },
      refresh() { if (on) return; const it = A.item(key); if (it && it !== data && !(data && it.updatedAt === data.updatedAt)) { data = I.cleanDocInk(it); o.pages().forEach(pg => { if (pg.querySelector('canvas.pdfc')) paintPage(pg); }); } },
      destroy() { flush(); if (eng) eng.destroy(); if (tools) tools.remove(); }
    };
  }

  window.WSNB = { init(x) { X = x; }, mountNotebook, annotator, create, keptState, tools: TOOLS, _paint: paint };
})();
