/* Birdbird – My Workspace map: draws a graph from wsgraph.js on a canvas (2D, devicePixelRatio aware, capped at 2).
   Frames are drawn only while something moves: the layout cooling down, a camera move, a drag. Once the layout has
   settled no animation frame is requested, so an idle map costs nothing. With reduced motion the layout is run to the
   end at once and drawn once.
   WSMAP.mount(host, { graph, t, mini, sample, onOpen(node, beside), onClick() }) -> { setGraph(g), fit(), focus(i), destroy(), debug }
   mini: a small, quiet map without controls (the desk home); a click calls onClick. */
(function () {
  'use strict';
  const GW = window.WSGRAPH;
  const COL = { aircraft: '#FFFFFF', doc: '#7EA8EC', page: '#5F86C9', note: '#E06AAE', notebook: '#EBA2CB', pack: '#E8B25C', route: '#6CC492', desk: '#B9C3CF' };
  const LEG = { aircraft: 'aircraft', doc: 'doc', note: 'note', pack: 'pack', route: 'route', desk: 'desk' };
  const BASE = { aircraft: 5, doc: 3.1, page: 1.6, note: 2.4, notebook: 2.6, pack: 3.2, route: 2.9, desk: 3.2 };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sprites = {};
  function sprite(c) {
    if (sprites[c]) return sprites[c];
    const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, c); g.addColorStop(0.18, c + 'AA'); g.addColorStop(0.45, c + '30'); g.addColorStop(1, c + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (sprites[c] = s);
  }
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function mount(host, o) {
    const t = o.t || ((en) => en), mini = !!o.mini, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const KN = { aircraft: t('Aircraft', 'Fly'), doc: t('Document', 'Dokument'), page: t('Page', 'Side'), note: t('Note', 'Notat'), notebook: t('Notebook', 'Notatbok'), pack: t('Briefing pack', 'Briefingpakke'), route: t('Route', 'Rute'), desk: t('Desk', 'Arbeidsflate') };
    const GN = { aircraft: t('Aircraft', 'Fly'), doc: t('Documents', 'Dokumenter'), note: t('Notes', 'Notater'), pack: t('Packs', 'Pakker'), route: t('Routes', 'Ruter'), desk: t('Desks', 'Arbeidsflater') };
    host.classList.add('wsm'); if (mini) host.classList.add('mini');
    host.innerHTML = `<canvas class="wsm-c"${mini ? ' aria-hidden="true"' : ` tabindex="0" role="img" aria-roledescription="${esc(t('map', 'kart'))}"`}></canvas>` + (mini ? '' : `
      <div class="wsm-top">
        <div class="wsm-q"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2"/><path d="M12.6 12.6 17 17"/></svg><input type="search" class="wsm-qi" placeholder="${esc(t('Find on the map', 'Finn på kartet'))}" aria-label="${esc(t('Find on the map', 'Finn på kartet'))}" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list"><ul class="wsm-sug" role="listbox" hidden></ul></div>
        <span class="sp"></span>
        <div class="wsm-zm"><button type="button" data-z="in" aria-label="${esc(t('Zoom in', 'Zoom inn'))}">+</button><button type="button" data-z="out" aria-label="${esc(t('Zoom out', 'Zoom ut'))}">−</button><button type="button" data-z="fit">${esc(t('Fit', 'Tilpass'))}</button></div>
      </div>
      <div class="wsm-card" hidden></div>
      <div class="wsm-leg" role="group" aria-label="${esc(t('Show on the map', 'Vis på kartet'))}"></div>`);
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
    const card = host.querySelector('.wsm-card'), legEl = host.querySelector('.wsm-leg'), qi = host.querySelector('.wsm-qi'), sug = host.querySelector('.wsm-sug');
    let g = null, L = null, W = 0, H = 0, dpr = 1, alive = true, raf = 0, auto = true, fitK = 1;
    const cam = { x: 0, y: 0, k: 1 };
    let hover = -1, sel = -1, tween = null, hidden = new Set(), nb = null, drag = null;
    const dbg = { frames: 0, draws: 0, get running() { return !!raf; }, get settled() { return !L || L.settled; } };

    /* ---------- data ---------- */
    function setGraph(ng, keep) {
      const prev = keep && L && g ? L.positions() : null;
      g = ng; L = GW.layout(g, { prev });
      hover = -1; sel = -1; nb = null; if (card) card.hidden = true;
      if (reduced() || mini && reduced()) { L.run(900); fitNow(); request(); }
      else { if (!prev) { L.step(10); auto = true; } request(); }
      drawLegend(); host.setAttribute('data-nodes', g.nodes.length);
      if (!mini) cv.setAttribute('aria-label', t('Map of your workspace: ', 'Kart over arbeidsområdet ditt: ') + legendText());
    }
    const visible = i => !hidden.has(g.nodes[i].g);
    const legendText = () => GW.GROUPS.filter(k => g.counts[k] || k !== 'desk').map(k => GN[k] + ' ' + g.counts[k]).join(' · ');
    function drawLegend() {
      if (!legEl) return;
      legEl.innerHTML = GW.GROUPS.filter(k => g.counts[k] || k !== 'desk').map((k, i) => `${i ? '<span class="dot" aria-hidden="true">·</span>' : ''}<button type="button" data-g="${k}" aria-pressed="${!hidden.has(k)}"><i style="background:${COL[k]}"></i>${esc(GN[k])} <b>${g.counts[k]}</b></button>`).join('');
    }

    /* ---------- camera ---------- */
    const sx = i => (L.x[i] - cam.x) * cam.k + W / 2, sy = i => (L.y[i] - cam.y) * cam.k + H / 2;
    const toWorld = (px, py) => [(px - W / 2) / cam.k + cam.x, (py - H / 2) / cam.k + cam.y];
    function fitTarget() {
      const idx = g.nodes.map((n, i) => i).filter(visible); const b = L.bounds(idx.length ? idx : null);
      const pad = mini ? 18 : 56, bw = Math.max(80, b.x1 - b.x0), bh = Math.max(80, b.y1 - b.y0);
      const padB = mini ? 18 : (o.padBottom || 64);
      const k = Math.min((W - pad * 2) / bw, (H - pad - padB) / bh, mini ? 2.2 : 2.6);
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 + (padB - pad) / 2 / k, k: Math.max(0.05, k) };
    }
    function fitNow() { if (!W) return; const f = fitTarget(); cam.x = f.x; cam.y = f.y; cam.k = f.k; fitK = f.k; }
    function moveTo(tg, ms) {
      auto = false;
      if (reduced() || !ms) { Object.assign(cam, tg); request(); return; }
      tween = { a: Object.assign({}, cam), b: tg, t0: performance.now(), ms }; request();
    }
    function zoomAt(f, px, py) {
      auto = false; tween = null;
      const k = Math.max(fitK * 0.4, Math.min(fitK * 14, cam.k * f)), [wx, wy] = toWorld(px, py);
      cam.k = k; cam.x = wx - (px - W / 2) / k; cam.y = wy - (py - H / 2) / k; request();
    }

    /* ---------- frames: only while something moves ---------- */
    function request() { if (!raf && alive) raf = requestAnimationFrame(frame); }
    function frame(ts) {
      raf = 0; if (!alive) return; dbg.frames++;
      let more = false;
      if (!L.settled) { L.step(mini ? 3 : 2); more = !L.settled; if (auto) { const f = fitTarget(); cam.x += (f.x - cam.x) * 0.12; cam.y += (f.y - cam.y) * 0.12; cam.k += (f.k - cam.k) * 0.12; fitK = f.k; } }
      else if (auto) { const f = fitTarget(); fitK = f.k; if (Math.abs(f.k - cam.k) / f.k > 0.002 || Math.hypot(f.x - cam.x, f.y - cam.y) * cam.k > 0.3) { cam.x += (f.x - cam.x) * 0.2; cam.y += (f.y - cam.y) * 0.2; cam.k += (f.k - cam.k) * 0.2; more = true; } else { auto = false; Object.assign(cam, f); } }
      if (tween) {
        const p = Math.min(1, (ts - tween.t0) / tween.ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        cam.x = tween.a.x + (tween.b.x - tween.a.x) * e; cam.y = tween.a.y + (tween.b.y - tween.a.y) * e; cam.k = tween.a.k * Math.pow(tween.b.k / tween.a.k, e);
        if (p >= 1) tween = null; else more = true;
      }
      draw();
      if (more) request();
    }
    function resize() {
      const r = cv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height); if (!w || !h) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === W && h === H && cv.width === Math.round(w * dpr)) return;
      const first = !W; W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); bg = null;
      if (first || auto || L.settled && !drag && !tween && Math.abs(cam.k - fitK) / fitK < 0.01) { fitNow(); }
      draw();
    }
    let bg = null;
    function draw() {
      if (!W || !g) return; dbg.draws++;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!bg) { bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75); bg.addColorStop(0, '#13305A'); bg.addColorStop(0.55, '#0B2545'); bg.addColorStop(1, '#081B35'); }
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const N = g.nodes.length, zk = cam.k / (fitK || 1), focus = hover >= 0 ? hover : sel, near = focus >= 0 ? (nb && nb.i === focus ? nb.s : (nb = { i: focus, s: neigh(focus) }).s) : null;
      const sizeK = Math.min(2.4, Math.max(0.75, Math.sqrt(zk))) * (mini ? 0.82 : 1);
      const px = new Float32Array(N), py = new Float32Array(N), pr = new Float32Array(N), vis = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (!visible(i)) continue; const n = g.nodes[i];
        px[i] = sx(i); py[i] = sy(i); pr[i] = (BASE[n.k] || 2) * sizeK * (n.k === 'doc' || n.k === 'aircraft' ? 1 + Math.min(0.5, n.deg * 0.025) : 1);
        vis[i] = px[i] > -40 && px[i] < W + 40 && py[i] > -40 && py[i] < H + 40 ? 1 : 0;
      }
      /* links: hairlines */
      ctx.lineWidth = mini ? 0.5 : 0.6; ctx.strokeStyle = near ? 'rgba(191,202,214,.06)' : 'rgba(191,202,214,.14)'; ctx.beginPath();
      const hl = [];
      for (const l of g.links) { if (!visible(l.s) || !visible(l.t) || !(vis[l.s] || vis[l.t])) continue; if (near && (l.s === focus || l.t === focus)) { hl.push(l); continue; } ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }
      ctx.stroke();
      if (hl.length) { ctx.strokeStyle = 'rgba(232,238,243,.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); hl.forEach(l => { ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }); ctx.stroke(); }
      /* glow, then the dots, one path per colour */
      const ga = mini ? 0.42 : 0.5;
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i], r = pr[i] * (n.k === 'aircraft' ? 5.5 : 4.2); ctx.globalAlpha = (near && !near.has(i) ? 0.12 : 1) * ga; ctx.drawImage(sprite(COL[n.k]), px[i] - r, py[i] - r, r * 2, r * 2); }
      ctx.globalAlpha = 1;
      for (const k in COL) {
        for (const dim of [false, true]) {
          ctx.beginPath(); let any = false;
          for (let i = 0; i < N; i++) { if (!vis[i] || g.nodes[i].k !== k || (!!(near && !near.has(i)) !== dim)) continue; ctx.moveTo(px[i] + pr[i], py[i]); ctx.arc(px[i], py[i], pr[i], 0, Math.PI * 2); any = true; }
          if (any) { ctx.globalAlpha = dim ? 0.28 : 0.95; ctx.fillStyle = COL[k]; ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
      /* rings: aircraft, annotated documents, the focused node */
      ctx.lineWidth = 0.8;
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i]; if (n.k === 'aircraft' || n.ink) { ctx.strokeStyle = n.k === 'aircraft' ? 'rgba(255,255,255,.32)' : 'rgba(126,168,236,.5)'; ctx.beginPath(); ctx.arc(px[i], py[i], pr[i] + (n.k === 'aircraft' ? 4 : 2.2), 0, Math.PI * 2); ctx.stroke(); } }
      if (focus >= 0 && vis[focus]) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px[focus], py[focus], pr[focus] + 3.5, 0, Math.PI * 2); ctx.stroke(); }
      if (mini) return;
      /* labels: on hover, near the focus, and when zoomed in (aircraft first, then documents, then everything) */
      ctx.textBaseline = 'middle'; const taken = [];
      const free = (x0, y0, x1, y1) => { for (const r of taken) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false; taken.push([x0, y0, x1, y1]); return true; };
      const label = (i, strong) => {
        const n = g.nodes[i], s = n.label.length > 42 ? n.label.slice(0, 40) + '…' : n.label;
        ctx.font = (n.k === 'aircraft' ? '600 12px ' : strong ? '600 12px ' : '500 11px ') + 'Public Sans, system-ui, sans-serif';
        const w = ctx.measureText(s).width, x = px[i] + pr[i] + 6, y = py[i];
        if (!strong && !free(x - 2, y - 8, x + w + 2, y + 8)) return;
        if (strong) taken.push([x - 2, y - 8, x + w + 2, y + 8]);
        ctx.fillStyle = strong ? '#FFFFFF' : n.k === 'aircraft' ? 'rgba(255,255,255,.82)' : 'rgba(213,222,231,.72)';
        if (strong) { ctx.save(); ctx.fillStyle = 'rgba(8,27,53,.78)'; ctx.fillRect(x - 4, y - 10, w + 8, 20); ctx.restore(); ctx.fillStyle = '#fff'; }
        ctx.fillText(s, x, y);
      };
      if (focus >= 0 && vis[focus]) label(focus, true);
      const order = [];
      for (let i = 0; i < N; i++) {
        if (!vis[i] || i === focus) continue; const k = g.nodes[i].k;
        const show = near ? near.has(i) : (k === 'aircraft' ? zk >= 1.25 : k === 'doc' || k === 'pack' || k === 'route' || k === 'desk' ? zk >= 1.9 : zk >= 2.7);
        if (show) order.push(i);
      }
      order.sort((a, b) => (g.nodes[a].k === 'aircraft' ? 0 : 1) - (g.nodes[b].k === 'aircraft' ? 0 : 1) || g.nodes[b].deg - g.nodes[a].deg);
      order.slice(0, 260).forEach(i => label(i, false));
    }
    function neigh(i) { const s = new Set([i]); for (const l of g.links) { if (l.s === i) s.add(l.t); else if (l.t === i) s.add(l.s); } return s; }

    /* ---------- pointer: pan, drag a node, pinch, wheel, click to open ---------- */
    function hit(x, y) {
      let best = -1, bd = Infinity; const zk = cam.k / (fitK || 1), sk = Math.min(2.4, Math.max(0.75, Math.sqrt(zk)));
      for (let i = 0; i < g.nodes.length; i++) { if (!visible(i)) continue; const dx = sx(i) - x, dy = sy(i) - y, d = dx * dx + dy * dy, r = (BASE[g.nodes[i].k] || 2) * sk + 7; if (d < r * r && d < bd) { bd = d; best = i; } }
      return best;
    }
    const pts = new Map(); let pinch = null, moved = 0;
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function down(e) {
      if (mini) return;
      cv.setPointerCapture(e.pointerId); const [x, y] = local(e); pts.set(e.pointerId, [x, y]); moved = 0; tween = null;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; if (drag && drag.node >= 0) L.free(drag.node); drag = null; return; }
      const i = hit(x, y); drag = { node: i, x, y, sx: x, sy: y, shift: e.shiftKey || e.altKey };
    }
    function move(e) {
      const [x, y] = local(e);
      if (mini) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; cam.x -= (m[0] - pinch.m[0]) / cam.k; cam.y -= (m[1] - pinch.m[1]) / cam.k; zoomAt(d / (pinch.d || d), m[0], m[1]); pinch = { d, m }; moved = 99; return; }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y; moved = Math.max(moved, Math.hypot(x - drag.sx, y - drag.sy)); if (moved < 4) return;
        auto = false;
        if (drag.node >= 0) { const [wx, wy] = toWorld(x, y); L.fix(drag.node, wx, wy); L.reheat(0.12); hover = drag.node; }
        else { cam.x -= dx / cam.k; cam.y -= dy / cam.k; cv.style.cursor = 'grabbing'; }
        drag.x = x; drag.y = y; request(); return;
      }
      if (e.pointerType === 'touch') return;
      const i = hit(x, y); if (i !== hover) { hover = i; cv.style.cursor = i >= 0 ? 'pointer' : ''; request(); }
    }
    function up(e) {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
      const d = drag; drag = null; cv.style.cursor = hover >= 0 ? 'pointer' : '';
      if (!d) return;
      if (d.node >= 0 && moved >= 4) { L.free(d.node); L.reheat(0.08); request(); return; }
      if (moved < 4 && d.node >= 0) open(d.node, d.shift || e.shiftKey || e.altKey);
      else if (moved < 4 && sel >= 0) select(-1);
    }
    function wheel(e) {
      if (mini) return; e.preventDefault();
      const [x, y] = local(e);
      const mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || mouse) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018) * (e.deltaMode === 1 ? 30 : 1)), x, y);
      else { auto = false; tween = null; cam.x += e.deltaX / cam.k; cam.y += e.deltaY / cam.k; request(); }
    }
    function leave() { if (hover >= 0 && !drag) { hover = -1; request(); } }
    function open(i, beside) {
      const n = g.nodes[i]; if (!n) return;
      if (o.sample) { select(i); return; }
      if (o.onOpen) o.onOpen(n, !!beside);
    }
    function select(i, zoom) {
      sel = i; nb = null;
      if (card) {
        if (i < 0) card.hidden = true;
        else { const n = g.nodes[i]; card.hidden = false;
          card.innerHTML = `<span class="k"><i style="background:${COL[n.k]}"></i>${esc(KN[n.k])}${o.sample ? ' · ' + esc(t('Example', 'Eksempel')) : ''}</span><b>${esc(n.label)}</b><span class="m">${esc(n.deg === 1 ? t('1 link', '1 kobling') : t(n.deg + ' links', n.deg + ' koblinger'))}</span>` +
            (o.sample ? '' : `<span class="b"><button type="button" class="btn sm pri" data-o="here">${esc(t('Open on the desk', 'Åpne på arbeidsflaten'))}</button><button type="button" class="btn sm" data-o="beside">${esc(t('Open beside', 'Åpne ved siden av'))}</button></span>`); }
      }
      if (i >= 0 && zoom) moveTo({ x: L.x[i], y: L.y[i], k: Math.max(cam.k, fitK * 2.4) }, 520);
      request();
    }
    if (card) card.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (b && sel >= 0) open(sel, b.dataset.o === 'beside'); });
    function key(e) {
      if (e.target !== cv) return;
      const step = 60;
      if (e.key === '+' || e.key === '=') zoomAt(1.25, W / 2, H / 2); else if (e.key === '-') zoomAt(0.8, W / 2, H / 2);
      else if (e.key === '0') moveTo(fitTarget(), 380);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { auto = false; cam.x += (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0) / cam.k; cam.y += (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) / cam.k; request(); }
      else if (e.key === 'Enter' && sel >= 0) open(sel, e.shiftKey || e.altKey);
      else if (e.key === 'Escape' && sel >= 0) select(-1);
      else return;
      e.preventDefault();
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('keydown', key);
    cv.addEventListener('dblclick', e => { if (mini) return; const [x, y] = local(e); if (hit(x, y) < 0) zoomAt(1.8, x, y); });
    if (mini) cv.addEventListener('click', () => { if (o.onClick) o.onClick(); });

    /* ---------- toolbar, legend, search ---------- */
    if (!mini) {
      host.querySelector('.wsm-zm').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; if (b.dataset.z === 'fit') moveTo(fitTarget(), 420); else zoomAt(b.dataset.z === 'in' ? 1.4 : 1 / 1.4, W / 2, H / 2); });
      legEl.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g; if (hidden.has(k)) hidden.delete(k); else hidden.add(k); if (sel >= 0 && !visible(sel)) select(-1); hover = -1; nb = null; drawLegend(); const nb2 = legEl.querySelector(`[data-g="${k}"]`); if (nb2) nb2.focus(); request(); });
      let rows = [], cur = 0;
      const drawSug = () => {
        const q = fold(qi.value.trim()); rows = [];
        if (q) { const tk = q.split(/\s+/); g.nodes.forEach((n, i) => { if (!visible(i)) return; const f = fold(n.label); if (tk.every(x => f.includes(x))) rows.push([i, (f.startsWith(q) ? 0 : 1) + (n.k === 'page' ? 1 : 0)]); }); rows.sort((a, b) => a[1] - b[1] || g.nodes[b[0]].deg - g.nodes[a[0]].deg); rows = rows.slice(0, 7).map(r => r[0]); }
        cur = 0; sug.hidden = !rows.length && !q; qi.setAttribute('aria-expanded', String(!sug.hidden));
        sug.innerHTML = rows.length ? rows.map((i, k) => `<li role="option" id="wsmo${k}" data-i="${i}" aria-selected="${k === cur}"><i style="background:${COL[g.nodes[i].k]}"></i><span>${esc(g.nodes[i].label)}</span><small>${esc(KN[g.nodes[i].k])}</small></li>`).join('') : `<li class="none">${esc(t('Nothing on the map matches.', 'Ingenting på kartet passer.'))}</li>`;
        if (rows.length) qi.setAttribute('aria-activedescendant', 'wsmo0'); else qi.removeAttribute('aria-activedescendant');
      };
      const mark = () => sug.querySelectorAll('[role="option"]').forEach((li, k) => { li.setAttribute('aria-selected', String(k === cur)); if (k === cur) qi.setAttribute('aria-activedescendant', li.id); });
      const pickRow = k => { const i = rows[k]; if (i == null) return; sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); hover = -1; select(i, true); };
      qi.addEventListener('input', drawSug);
      qi.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!rows.length) return; e.preventDefault(); cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; mark(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (!sug.hidden && rows.length) pickRow(cur); else if (sel >= 0) open(sel, e.shiftKey || e.altKey); }
        else if (e.key === 'Escape') { if (!sug.hidden) { sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); } else { qi.value = ''; select(-1); } e.preventDefault(); e.stopPropagation(); }
      });
      qi.addEventListener('blur', () => setTimeout(() => { if (alive) { sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); } }, 150));
      sug.addEventListener('mousedown', e => e.preventDefault());
      sug.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (li) pickRow(rows.indexOf(+li.dataset.i)); });
    }

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (alive) resize(); }) : null;
    if (ro) ro.observe(cv); else window.addEventListener('resize', resize);
    setGraph(o.graph); resize();
    return {
      setGraph: ng => setGraph(ng, true), fit: () => moveTo(fitTarget(), 380), focus: i => select(i, true), debug: dbg,
      get graph() { return g; }, get camera() { return Object.assign({}, cam); }, get layout() { return L; },
      screenOf: i => [sx(i), sy(i)],
      destroy() { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); host.innerHTML = ''; cv.width = cv.height = 0; }
    };
  }
  window.WSMAP = { mount, COL };
})();
