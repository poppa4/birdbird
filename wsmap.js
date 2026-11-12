/* Birdbird – My Workspace map: draws a graph from wsgraph.js on a canvas (2D, devicePixelRatio aware, capped at 2).
   Frames are drawn only while something moves: the short intro, a camera move, a drag. Once still, no animation frame
   is requested, so an idle map costs nothing. With reduced motion it is drawn once.
   WSMAP.mount(host, { graph, t, mini, acLabels, sample, onOpen(node, beside), onClick() }) -> { setGraph(g), fit(), focus(i), destroy(), debug }
   mini: a small, quiet map without controls, labels or pulses (the desk home and the sidebar); acLabels: the aircraft
   regions are named on it (the desk home); a click calls onClick.
   Up to WSGRAPH.BRAIN_MAX nodes the map is a calm brain silhouette (outline, a faint inner light, two fissures) with
   only your own items inside it: each aircraft a named region, items without one under 'Unsorted'. Aircraft are always
   labelled, documents when there is room, the rest on hover. Lines are the links in your data, nothing else.
   sample: nothing of your own yet; the small example is shown, and hovering or tapping a dot explains what it would be
   in your workspace and offers the real action. Larger maps get the force layout with a soft brain-shaped glow.
   Life: rarely, a faint pulse travels along a real link, only on the full map (never the mini maps) while it is on screen and the page is visible,
   never with reduced motion. Pulse frames copy the cached picture and draw the pulse on top. */
(function () {
  'use strict';
  const GW = window.WSGRAPH;
  const COL = { aircraft: '#FFFFFF', doc: '#A9C7E6', page: '#6F8DB0', note: '#DCE8F4', notebook: '#C3D5E8', pack: '#E6D9BD', route: '#9CCFC7', desk: '#7E8C9C' };
  const LEG = { aircraft: 'aircraft', doc: 'doc', note: 'note', pack: 'pack', route: 'route', desk: 'desk' };
  const BASE = { aircraft: 6, doc: 4.2, page: 1.8, note: 2.7, notebook: 2.9, pack: 3.1, route: 3, desk: 3.2 };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sprites = {};
  function sprite(c) {
    if (sprites[c]) return sprites[c];
    const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, c); g.addColorStop(0.18, c + 'AA'); g.addColorStop(0.45, c + '30'); g.addColorStop(1, c + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (sprites[c] = s);
  }
  const stats = { pulseFrames: 0 };
  /* unit brain -> screen paths (each call builds one path) */
  function polyPath(ctx, P, f, closed) { P.forEach((p, k) => { const [a, b] = f(p[0], p[1]); if (k) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); if (closed) ctx.closePath(); }
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function mount(host, o) {
    const t = o.t || ((en) => en), mini = !!o.mini, acLabels = !!o.acLabels, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    const dbg = { frames: 0, draws: 0, pulseFrames: 0, glow: false, regions: [], labels: [], get pulses() { return pulses.length; }, get running() { return !!raf; }, get settled() { return !L || L.settled; } };
    let brainMode = false; const B = GW.BRAIN, coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let dirty = true, pulses = [], shown = null, scene = null, sceneOK = false, ambT = 0, pulseT = 0, onScreen = true;
    /* an example dot (nothing of your own yet): explained, never opened */
    const isEx = i => i >= 0 && !!g.nodes[i] && !!o.sample;

    /* ---------- data ---------- */
    function setGraph(ng, keep) {
      const prev = keep && L && g ? L.positions() : null;
      g = ng; brainMode = !!GW.brainLayout && g.nodes.length > 0 && g.nodes.length <= (GW.BRAIN_MAX || 600);
      L = brainMode ? GW.brainLayout(g, { instant: !!prev || reduced() }) : GW.layout(g, { prev }); pulses = [];
      hover = -1; sel = -1; nb = null; if (card) card.hidden = true;
      if (reduced()) { L.run(900); fitNow(); request(); }
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
      const idx = g.nodes.map((n, i) => i).filter(visible); const b = L.frame || L.bounds(idx.length ? idx : null);
      const pad = mini ? (L.frame ? 14 : 18) : L.frame ? 30 : 56, bw = Math.max(80, b.x1 - b.x0), bh = Math.max(80, b.y1 - b.y0);
      const padB = mini ? (L.frame ? 24 : 18) : (o.padBottom || 64);
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
    function request() { dirty = true; if (!raf && alive) raf = requestAnimationFrame(frame); }
    function frame(ts) {
      raf = 0; if (!alive) return; dbg.frames++;
      let more = false, full = dirty; dirty = false;
      if (!L.settled) { full = true; L.step(mini ? 3 : 2); more = !L.settled || auto; /* the camera finishes its fit too */ if (auto) { const f = fitTarget(); cam.x += (f.x - cam.x) * 0.12; cam.y += (f.y - cam.y) * 0.12; cam.k += (f.k - cam.k) * 0.12; fitK = f.k; } }
      else if (auto) { full = true; const f = fitTarget(); fitK = f.k; if (Math.abs(f.k - cam.k) / f.k > 0.002 || Math.hypot(f.x - cam.x, f.y - cam.y) * cam.k > 0.3) { cam.x += (f.x - cam.x) * 0.2; cam.y += (f.y - cam.y) * 0.2; cam.k += (f.k - cam.k) * 0.2; more = true; } else { auto = false; Object.assign(cam, f); } }
      if (tween) {
        full = true;
        const p = Math.min(1, (ts - tween.t0) / tween.ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        cam.x = tween.a.x + (tween.b.x - tween.a.x) * e; cam.y = tween.a.y + (tween.b.y - tween.a.y) * e; cam.k = tween.a.k * Math.pow(tween.b.k / tween.a.k, e);
        if (p >= 1) tween = null; else more = true;
      }
      if (full) draw();
      /* pulses: on top of the cached picture */
      const now = performance.now(); pulses = pulses.filter(p => now < p.t0 + p.dur);
      if (!full) { dbg.pulseFrames++; stats.pulseFrames++; } /* nothing else moved: this frame is only for a pulse */
      if (pulses.length) {
        const ops = pulseOps(now);
        if (!sceneOK) { if (!full) draw(); snapshot(); } else if (!full) { const r = union(shown, ops.box); if (r) blit(r); }
        drawPulses(ops); shown = ops.box;
      } else if (shown) { if (!full) { if (sceneOK) blit(shown); else draw(); } shown = null; }
      if (more) request();
      else if (pulses.length && !pulseT) pulseT = setTimeout(() => { pulseT = 0; if (alive && !raf) raf = requestAnimationFrame(frame); }, 30);
    }
    function snapshot() {
      if (!scene) scene = document.createElement('canvas');
      if (scene.width !== cv.width || scene.height !== cv.height) { scene.width = cv.width; scene.height = cv.height; }
      const c = scene.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, scene.width, scene.height); c.drawImage(cv, 0, 0); sceneOK = true;
    }
    /* copy back only the part of the picture the pulses touched (device pixels) */
    const union = (a, b) => !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
    function blit(r) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (!r) { ctx.drawImage(scene, 0, 0); return; }
      const x0 = Math.max(0, Math.floor(r[0] * dpr) - 2), y0 = Math.max(0, Math.floor(r[1] * dpr) - 2), x1 = Math.min(cv.width, Math.ceil(r[2] * dpr) + 2), y1 = Math.min(cv.height, Math.ceil(r[3] * dpr) + 2);
      if (x1 > x0 && y1 > y0) ctx.drawImage(scene, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    /* a pulse: { a, b, t0, dur, s } travels from node a to node b */
    function pulseOps(now) {
      const list = []; let box = null;
      for (const p of pulses) {
        const e = (now - p.t0) / p.dur; if (e < 0 || !visible(p.a) || !visible(p.b)) continue;
        const u = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2, ax = sx(p.a), ay = sy(p.a), bx = sx(p.b), by = sy(p.b), qx = ax + (bx - ax) * u, qy = ay + (by - ay) * u;
        const a = Math.sin(Math.PI * Math.min(1, e)) * p.s, tl = Math.max(0, u - 0.28), tx = ax + (bx - ax) * tl, ty = ay + (by - ay) * tl, r = (mini ? 5 : 8) * (0.7 + 0.3 * p.s);
        list.push({ tx, ty, qx, qy, a, r }); box = union(box, [Math.min(tx, qx) - r, Math.min(ty, qy) - r, Math.max(tx, qx) + r, Math.max(ty, qy) + r]);
      }
      return { list, box };
    }
    function drawPulses(ops) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const spr = sprite('#DCEBFA');
      for (const { tx, ty, qx, qy, a, r } of ops.list) {
        const gr = ctx.createLinearGradient(tx, ty, qx, qy); gr.addColorStop(0, 'rgba(214,232,250,0)'); gr.addColorStop(1, 'rgba(214,232,250,' + (0.55 * a).toFixed(3) + ')');
        ctx.strokeStyle = gr; ctx.lineWidth = mini ? 0.8 : 1.1; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(qx, qy); ctx.stroke();
        ctx.globalAlpha = Math.min(1, a * 1.1); ctx.drawImage(spr, qx - r, qy - r, r * 2, r * 2); ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const canPulse = () => alive && !mini && onScreen && L && L.settled && !drag && !reduced() && g.links.length && (typeof document === 'undefined' || document.visibilityState === 'visible');
    function kick() { if (!raf && !pulseT && alive) raf = requestAnimationFrame(frame); }
    /* from a touched node: its links light up one after the other, then the next ring, faintly; then it stops */
    function burst(i) {
      if (mini || reduced() || i < 0) return; const now = performance.now(), seen = new Set([i]); let ring = [i], n = 0;
      for (let h = 0; h < 1 && ring.length; h++) {
        const next = [];
        for (const a of ring) for (const l of g.links) { const b = l.s === a ? l.t : l.t === a ? l.s : -1; if (b < 0 || seen.has(b) || !visible(b) || n >= 18) continue; seen.add(b); next.push(b); pulses.push({ a, b, t0: now + h * 300, dur: 520, s: h ? 0.45 : 0.9 }); n++; }
        ring = next;
      }
      kick();
    }
    /* now and then: a faint pulse along a random link, sometimes on to the next one */
    function ambient() {
      ambT = 0; if (!canPulse()) return;
      const ls = g.links.filter(l => visible(l.s) && visible(l.t)); if (!ls.length) return;
      let l = ls[Math.floor(Math.random() * ls.length)], a = Math.random() < 0.5 ? l.s : l.t, b = a === l.s ? l.t : l.s, t0 = performance.now();
      for (let h = 0; h < 2; h++) {
        const dur = 1000 + Math.random() * 300; pulses.push({ a, b, t0, dur, s: 0.55 }); t0 += dur * 0.8;
        if (Math.random() < 0.6) break;
        const nx = ls.filter(m => (m.s === b || m.t === b) && !(m.s === a || m.t === a)); if (!nx.length) break;
        const m = nx[Math.floor(Math.random() * nx.length)]; a = b; b = m.s === a ? m.t : m.s;
      }
      kick(); schedule();
    }
    function schedule() { if (ambT || !canPulse()) return; ambT = setTimeout(ambient, 14000 + Math.random() * 12000); }
    function unschedule() { if (ambT) clearTimeout(ambT); ambT = 0; }
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) schedule(); else unschedule(); }) : null;
    if (io) io.observe(host);
    const onVis = () => { if (document.visibilityState === 'visible') schedule(); else unschedule(); };
    document.addEventListener('visibilitychange', onVis);
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
      if (!W || !g) return; dbg.draws++; sceneOK = false;
      if (L.settled && !ambT) schedule();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!bg || bg.w !== W || bg.h !== H) { /* a deep night blue, drawn once into a cached canvas */
        const c = document.createElement('canvas'); c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); const b = c.getContext('2d'); b.scale(dpr, dpr);
        const gr = b.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75); gr.addColorStop(0, '#0B1D37'); gr.addColorStop(0.55, '#071629'); gr.addColorStop(1, '#040C19');
        b.fillStyle = gr; b.fillRect(0, 0, W, H); bg = { c, w: W, h: H };
      }
      ctx.drawImage(bg.c, 0, 0, W, H);
      if (brainMode) drawBrain(); else if (g.nodes.length >= 8) drawGlow();
      const N = g.nodes.length, zk = cam.k / (fitK || 1), focus = hover >= 0 ? hover : sel, near = focus >= 0 ? (nb && nb.i === focus ? nb.s : (nb = { i: focus, s: neigh(focus) }).s) : null;
      const sizeK = Math.min(2, Math.max(0.8, Math.sqrt(zk))) * (mini ? 0.78 : W < 600 ? 0.85 : 1);
      const px = new Float32Array(N), py = new Float32Array(N), pr = new Float32Array(N), vis = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (!visible(i)) continue; const n = g.nodes[i];
        px[i] = sx(i); py[i] = sy(i); pr[i] = (BASE[n.k] || 2) * sizeK * (n.k === 'doc' ? 1 + Math.min(0.35, n.deg * 0.04) : 1);
        vis[i] = px[i] > -40 && px[i] < W + 40 && py[i] > -40 && py[i] < H + 40 ? 1 : 0;
      }
      /* the region names, behind everything (they also keep dot labels off them) */
      ctx.textBaseline = 'middle'; const taken = [];
      const free = (x0, y0, x1, y1) => { for (const r of taken) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false; taken.push([x0, y0, x1, y1]); return true; };
      dbg.labels = [];
      if (brainMode && L.regions && (!mini || acLabels)) drawRegions(taken);
      /* links: the real ones, as hairlines */
      ctx.lineWidth = mini ? 0.6 : 0.9; ctx.lineCap = 'round'; ctx.strokeStyle = near ? 'rgba(150,182,218,.08)' : mini ? 'rgba(160,192,228,.22)' : 'rgba(160,192,228,.26)'; ctx.beginPath();
      const hl = [];
      for (const l of g.links) { if (!visible(l.s) || !visible(l.t) || !(vis[l.s] || vis[l.t])) continue; if (near && (l.s === focus || l.t === focus)) { hl.push(l); continue; } ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }
      ctx.stroke();
      if (hl.length) { ctx.strokeStyle = 'rgba(214,232,250,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); hl.forEach(l => { ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }); ctx.stroke(); }
      /* a soft halo, then the dots, one path per colour */
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i], r = pr[i] * (n.k === 'aircraft' ? 4 : 3.2); ctx.globalAlpha = (near && !near.has(i) ? 0.1 : 1) * (mini ? 0.45 : 0.5); ctx.drawImage(sprite(COL[n.k]), px[i] - r, py[i] - r, r * 2, r * 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      for (const k in COL) {
        for (const dim of [false, true]) {
          ctx.beginPath(); let any = false;
          for (let i = 0; i < N; i++) { if (!vis[i] || g.nodes[i].k !== k || (!!(near && !near.has(i)) !== dim)) continue; ctx.moveTo(px[i] + pr[i], py[i]); ctx.arc(px[i], py[i], pr[i], 0, Math.PI * 2); any = true; }
          if (any) { ctx.globalAlpha = dim ? 0.3 : 1; ctx.fillStyle = COL[k]; ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
      /* rings: aircraft, annotated documents, the focused node */
      ctx.lineWidth = mini ? 0.6 : 0.9;
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i]; if (n.k === 'aircraft' || n.ink) { ctx.strokeStyle = n.k === 'aircraft' ? 'rgba(255,255,255,.36)' : 'rgba(169,199,230,.5)'; ctx.beginPath(); ctx.arc(px[i], py[i], pr[i] + (n.k === 'aircraft' ? (mini ? 2.5 : 4.5) : 2.4), 0, Math.PI * 2); ctx.stroke(); } }
      if (focus >= 0 && vis[focus]) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px[focus], py[focus], pr[focus] + 3.5, 0, Math.PI * 2); ctx.stroke(); }
      if (mini) return;
      /* labels: aircraft always, documents when there is room, the rest on hover (or near the focus, or zoomed in) */
      const narrow = W < 600;
      const label = (i, mode) => { /* mode: 'focus' | 'force' | '' */
        const n = g.nodes[i], strong = mode === 'focus', cap = strong ? (narrow ? 30 : 44) : n.k === 'aircraft' ? 16 : narrow ? 15 : 20, raw = n.label, s = raw.length > cap ? raw.slice(0, cap - 1).trimEnd() + '…' : raw;
        ctx.font = strong ? '600 12.5px Public Sans, system-ui, sans-serif' : n.k === 'aircraft' ? '500 11px IBM Plex Mono, ui-monospace, monospace' : (narrow ? '500 10.5px ' : '500 11.5px ') + 'Public Sans, system-ui, sans-serif';
        const w = ctx.measureText(s).width, x = px[i] + pr[i] + 6, y = py[i];
        if (!mode && !free(x - 2, y - 8, x + w + 2, y + 8)) return;
        if (mode) taken.push([x - 2, y - 8, x + w + 2, y + 8]);
        if (strong) { ctx.fillStyle = 'rgba(3,10,22,.85)'; ctx.fillRect(x - 4, y - 10, w + 8, 20); }
        ctx.fillStyle = strong ? '#FFFFFF' : n.k === 'aircraft' ? 'rgba(236,244,252,.88)' : 'rgba(206,222,238,.74)';
        ctx.fillText(s, x, y); dbg.labels.push(n.id);
      };
      for (let i = 0; i < N; i++) if (vis[i]) taken.push([px[i] - pr[i] - 1, py[i] - pr[i] - 1, px[i] + pr[i] + 1, py[i] + pr[i] + 1]); /* labels keep off the dots */
      if (focus >= 0 && vis[focus]) label(focus, 'focus');
      for (let i = 0; i < N; i++) if (vis[i] && i !== focus && g.nodes[i].k === 'aircraft') label(i, 'force');
      const order = [];
      for (let i = 0; i < N; i++) {
        if (!vis[i] || i === focus) continue; const k = g.nodes[i].k; if (k === 'aircraft') continue;
        const show = near ? near.has(i) : k === 'doc' ? true : zk >= 2.2;
        if (show) order.push(i);
      }
      order.sort((a, b) => (g.nodes[a].k === 'doc' ? 0 : 1) - (g.nodes[b].k === 'doc' ? 0 : 1) || g.nodes[b].deg - g.nodes[a].deg || a - b);
      order.slice(0, 200).forEach(i => label(i, ''));
    }
    /* ---------- the brain: a calm silhouette, or a soft glow behind a large map ---------- */
    function brainPath(f) { ctx.beginPath(); polyPath(ctx, B.cerebrum, f, true); polyPath(ctx, B.cerebellum, f, true); }
    function drawBrain() {
      const S = L.S, k = cam.k, f = (u, v) => [(u * S - cam.x) * k + W / 2, (v * S - cam.y) * k + H / 2], ppu = S * k, [cx, cy] = f(B.core[0], B.core[1]);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      /* a very subtle inner light */
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, ppu * 1.1); gr.addColorStop(0, 'rgba(70,128,206,.13)'); gr.addColorStop(0.6, 'rgba(48,100,178,.05)'); gr.addColorStop(1, 'rgba(36,78,150,.015)');
      ctx.fillStyle = gr; brainPath(f); ctx.fill();
      /* outline: a wide soft line and a hairline; brain stem and two fissures fainter */
      ctx.strokeStyle = 'rgba(110,162,228,.07)'; ctx.lineWidth = mini ? 3 : 6; ctx.stroke(); ctx.strokeStyle = 'rgba(196,222,250,.34)'; ctx.lineWidth = mini ? 0.7 : 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(170,205,242,.13)'; ctx.lineWidth = mini ? 0.6 : 0.9; ctx.beginPath(); B.stem.forEach(P => polyPath(ctx, P, f, false)); ctx.stroke();
      ctx.strokeStyle = 'rgba(170,205,242,' + (mini ? 0.07 : 0.09) + ')'; ctx.beginPath(); B.fissures.forEach(P => polyPath(ctx, P, f, false)); ctx.stroke();
      ctx.restore();
    }
    /* each region named softly inside the brain: the aircraft type (DA42), or 'Unsorted' with a hint when there is no aircraft */
    function regionName(r) {
      if (r.ac < 0) return t('Unsorted', 'Uten fly');
      const n = g.nodes[r.ac], s = GW.shortType ? GW.shortType(n.type) : '';
      if (!s) return n.label;
      const dup = L.regions.some(q => q !== r && q.ac >= 0 && GW.shortType(g.nodes[q.ac].type) === s);
      return dup ? s + ' · ' + n.label : s;
    }
    function drawRegions(taken) {
      const noAc = !g.counts.aircraft;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const r of L.regions) {
        if (mini && r.ac < 0) continue;
        const s = regionName(r).toUpperCase(), x = (r.lx - cam.x) * cam.k + W / 2, y = (r.ly - cam.y) * cam.k + H / 2;
        const sm = mini || W < 600; ctx.font = mini ? '600 9.5px IBM Plex Mono, ui-monospace, monospace' : sm ? '600 10.5px IBM Plex Mono, ui-monospace, monospace' : '600 12px IBM Plex Mono, ui-monospace, monospace';
        if ('letterSpacing' in ctx) ctx.letterSpacing = sm ? '2px' : '3px';
        const w = ctx.measureText(s).width; ctx.fillStyle = mini ? 'rgba(214,232,250,.6)' : 'rgba(200,222,248,.42)'; ctx.fillText(s, x, y);
        taken.push([x - w / 2 - 4, y - 9, x + w / 2 + 4, y + 9]); dbg.labels.push('region:' + s);
        if (!mini && r.ac < 0 && noAc) {
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          ctx.font = (sm ? '400 11px' : '400 12px') + ' Public Sans, system-ui, sans-serif'; ctx.fillStyle = 'rgba(200,218,238,.5)';
          const h = t('Add an aircraft to group your documents', 'Legg til et fly for å gruppere dokumentene dine'), hw = ctx.measureText(h).width;
          ctx.fillText(h, x, y + 18); taken.push([x - hw / 2 - 4, y + 10, x + hw / 2 + 4, y + 26]);
        }
      }
      ctx.restore(); dbg.regions = L.regions.map(r => regionName(r));
    }
    function drawGlow() {
      const idx = g.nodes.map((n, i) => i).filter(visible); dbg.glow = idx.length >= 8; if (!dbg.glow) return;
      const b = L.bounds(idx), bb = B.bounds, bw = Math.max(60, b.x1 - b.x0), bh = Math.max(60, b.y1 - b.y0);
      let kx = bw * 1.04 / (bb.x1 - bb.x0), ky = bh * 1.06 / (bb.y1 - bb.y0); if (ky < kx * 0.72) ky = kx * 0.72; if (kx < ky * 0.85) kx = ky * 0.85;
      const wx = (b.x0 + b.x1) / 2, wy = (b.y0 + b.y1) / 2, ux = (bb.x0 + bb.x1) / 2, uy = (bb.y0 + bb.y1) / 2;
      const f = (u, v) => [(wx + (u - ux) * kx - cam.x) * cam.k + W / 2, (wy + (v - uy) * ky - cam.y) * cam.k + H / 2], [cx, cy] = f(B.core[0], B.core[1]);
      ctx.save(); ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(kx, ky) * cam.k * 1.05); gr.addColorStop(0, 'rgba(60,118,200,.11)'); gr.addColorStop(0.6, 'rgba(44,96,176,.045)'); gr.addColorStop(1, 'rgba(36,78,150,.01)');
      ctx.fillStyle = gr; brainPath(f); ctx.fill();
      ctx.strokeStyle = 'rgba(110,162,228,.05)'; ctx.lineWidth = mini ? 3 : 8; ctx.stroke(); ctx.strokeStyle = 'rgba(190,218,248,.13)'; ctx.lineWidth = mini ? 0.5 : 0.8; ctx.stroke();
      ctx.restore();
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
      const i = hit(x, y); drag = { node: brainMode ? -1 : i, hit: i, x, y, sx: x, sy: y, shift: e.shiftKey || e.altKey };
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
      const i = hit(x, y); if (i !== hover) { const was = hover; hover = i; cv.style.cursor = i >= 0 ? 'pointer' : ''; if (isEx(i)) { showCard(i); burst(i); } else if (isEx(was)) showCard(sel); request(); }
    }
    function up(e) {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
      const d = drag; drag = null; cv.style.cursor = hover >= 0 ? 'pointer' : '';
      if (!d) return;
      if (d.node >= 0 && moved >= 4) { L.free(d.node); L.reheat(0.08); request(); return; }
      if (moved < 4 && d.hit >= 0) open(d.hit, d.shift || e.shiftKey || e.altKey);
      else if (moved < 4 && sel >= 0) select(-1);
    }
    function wheel(e) {
      if (mini) return; e.preventDefault();
      const [x, y] = local(e);
      const mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || mouse) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018) * (e.deltaMode === 1 ? 30 : 1)), x, y);
      else { auto = false; tween = null; cam.x += e.deltaX / cam.k; cam.y += e.deltaY / cam.k; request(); }
    }
    function leave() { if (hover >= 0 && !drag) { const was = hover; hover = -1; if (isEx(was)) showCard(sel); request(); } }
    function open(i, beside) {
      const n = g.nodes[i]; if (!n) return;
      if (isEx(i)) { select(i); return; }
      if (o.onOpen) o.onOpen(n, !!beside);
    }
    /* the example explains each dot: what it would be in your workspace, and the real action */
    const ACT = { aircraft: ['ac-new', t('Add aircraft', 'Legg til fly')], doc: ['doc-add', t('Add a document', 'Legg til et dokument')], page: ['doc-add', t('Add a document', 'Legg til et dokument')], note: ['map-note', t('New note', 'Nytt notat')], notebook: ['map-note', t('New note', 'Nytt notat')], pack: ['pack-new', t('Make a briefing pack', 'Lag en briefingpakke')], route: ['', t('Plan a route', 'Planlegg en rute')] };
    const ART = { aircraft: ['an aircraft', 'et fly'], doc: ['a document', 'et dokument'], page: ['a page reference', 'en sidehenvisning'], note: ['a note', 'et notat'], notebook: ['a notebook', 'en notatbok'], pack: ['a briefing pack', 'en briefingpakke'], route: ['a route', 'en rute'], desk: ['a desk', 'en arbeidsflate'] };
    const WOULD = k => { const a = ART[k] || ART.note; return t(`Example — this is where ${a[0]} would go`, `Eksempel — her hører ${a[1]} hjemme`); };
    function explain(i) {
      const n = g.nodes[i], nb2 = [...neigh(i)].filter(j => j !== i).map(j => g.nodes[j]), of = k => nb2.filter(m => m.k === k).map(m => m.label);
      const q = s => t('“', '«') + s + t('”', '»'), list = a => a.slice(0, 2).join(t(' and ', ' og ')) + (a.length > 2 ? t(` and ${a.length - 2} more`, ` og ${a.length - 2} til`) : '');
      const ac = n.ac && g.index[n.ac] != null && n.k !== 'aircraft' ? g.nodes[g.index[n.ac]].label : '';
      if (n.k === 'aircraft') return t(`An aircraft you fly${n.type ? ', a ' + n.type : ''}. It gets its own region of the map, where its documents, notes and briefing packs gather.`, `Et fly du flyr${n.type ? ', en ' + n.type : ''}. Det får sitt eget område på kartet, der dokumentene, notatene og briefingpakkene samles.`);
      if (n.k === 'doc') { const ns = of('note'); return (ac ? t(`Your ${n.label}, filed under ${ac}.`, `Din ${n.label}, lagt under ${ac}.`) : t(`A document like ${n.label}.`, `Et dokument som ${n.label}.`)) + (ns.length ? t(` Notes that cite its pages link here, like ${q(ns[0])}.`, ` Notater som viser til sidene, kobles hit, som ${q(ns[0])}.`) : t(' Notes that cite its pages link here.', ' Notater som viser til sidene, kobles hit.')); }
      if (n.k === 'page') { const ns = of('note'); return ns.length ? t(`A page in your manual that a note refers to: ${q(ns[0])} cites it.`, `En side i manualen din som et notat viser til: ${q(ns[0])} viser til den.`) : t('A page in your manual that a note refers to.', 'En side i manualen din som et notat viser til.'); }
      if (n.k === 'note' || n.k === 'notebook') { const ps = of('page').concat(of('doc')); return ps.length ? t(`A note of your own. This one cites a page in ${list(ps)}.`, `Et notat du skriver selv. Dette viser til en side i ${list(ps)}.`) : t(`A note of your own${ac ? ', linked to ' + ac : ''}.`, `Et notat du skriver selv${ac ? ', koblet til ' + ac : ''}.`); }
      if (n.k === 'pack') { const r = of('route'); return t(`Briefing pack ${n.label.replace(' – ', '→')}${r.length ? ', linked to its route' : ''}${ac ? ' and to ' + ac : ''}.`, `Briefingpakke ${n.label.replace(' – ', '→')}${r.length ? ', koblet til ruten sin' : ''}${ac ? ' og til ' + ac : ''}.`); }
      if (n.k === 'route') { const pk = of('pack'); return t(`A route from Route Explorer${pk.length ? ', linked to the briefing pack ' + pk[0].replace(' – ', '→') : ''}.`, `En rute fra Route Explorer${pk.length ? ', koblet til briefingpakken ' + pk[0].replace(' – ', '→') : ''}.`); }
      return '';
    }
    function showCard(i) {
      if (!card) return;
      if (i < 0) { card.hidden = true; return; }
      const n = g.nodes[i], sub = n.k === 'aircraft' && n.type ? `<span class="m">${esc(n.type)}</span>` : ''; card.hidden = false;
      if (isEx(i)) {
        const a = ACT[n.k], pinned = i === sel;
        card.innerHTML = `<span class="k"><i style="background:${COL[n.k]}"></i>${esc(KN[n.k])} · ${esc(t('Example', 'Eksempel'))}</span><b>${esc(n.label)}</b>${sub}<span class="w">${esc(WOULD(n.k))}</span><span class="x">${esc(explain(i))}</span>` +
          (pinned ? `<span class="b">${a ? (a[0] ? `<button type="button" class="btn sm pri" data-act="${a[0]}">${esc(a[1])}</button>` : `<a class="btn sm pri" href="route.html">${esc(a[1])}</a>`) : ''}</span>` : `<span class="m">${esc(coarse ? t('Tap to add your own', 'Trykk for å legge til ditt eget') : t('Click to add your own', 'Klikk for å legge til ditt eget'))}</span>`);
        return;
      }
      card.innerHTML = `<span class="k"><i style="background:${COL[n.k]}"></i>${esc(KN[n.k])}</span><b>${esc(n.label)}</b>${sub}<span class="m">${esc(n.deg === 1 ? t('1 link', '1 kobling') : t(n.deg + ' links', n.deg + ' koblinger'))}</span>` +
        `<span class="b"><button type="button" class="btn sm pri" data-o="here">${esc(t('Open on the desk', 'Åpne på arbeidsflaten'))}</button><button type="button" class="btn sm" data-o="beside">${esc(t('Open beside', 'Åpne ved siden av'))}</button></span>`;
    }
    function select(i, zoom) {
      const was = sel; sel = i; nb = null;
      showCard(i);
      if (isEx(i) && i !== was && i !== hover) burst(i);
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
        if (q) { const tk = q.split(/\s+/); g.nodes.forEach((n, i) => { if (!visible(i)) return; const f = fold(n.label + (n.type ? ' ' + n.type : '')); if (tk.every(x => f.includes(x))) rows.push([i, (f.startsWith(q) ? 0 : 1) + (n.k === 'page' ? 1 : 0)]); }); rows.sort((a, b) => a[1] - b[1] || g.nodes[b[0]].deg - g.nodes[a[0]].deg); rows = rows.slice(0, 7).map(r => r[0]); }
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
    return (host.wsmap = {
      setGraph: ng => setGraph(ng, true), pulseNow: () => { unschedule(); ambient(); }, fit: () => moveTo(fitTarget(), 380), focus: i => select(i, true), debug: dbg,
      get graph() { return g; }, get camera() { return Object.assign({}, cam); }, get layout() { return L; },
      screenOf: i => [sx(i), sy(i)],
      destroy() { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; unschedule(); if (pulseT) clearTimeout(pulseT); pulseT = 0; if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis); scene = null; if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); host.innerHTML = ''; cv.width = cv.height = 0; host.wsmap = null; }
    });
  }
  window.WSMAP = { mount, COL, stats };
})();
