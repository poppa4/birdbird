/* Birdbird – My Workspace map: draws a graph from wsgraph.js on a canvas (2D, devicePixelRatio aware, capped at 2).
   Frames are drawn only while something moves: the short intro, a camera move, a pan. Once still, no animation frame
   is requested, so an idle map costs nothing. With reduced motion it is drawn once.
   WSMAP.mount(host, { graph, t, mini, labels, sample, onOpen(node, beside), onEdit(what, node or group, button), onClick(), padBottom, view })
     -> { setGraph(g), fit(), focus(i), focusGroup(k), destroy(), debug }
   The map is a calm cloud (WSGRAPH.cloudLayout): each aircraft and each topic a soft glowing blob of evenly spread dots,
   'Unsorted' one more, the blobs together one cloud with no lines round it. Every group has a clear name and count ('DA42 · 6'),
   placed where it collides with nothing and stays on the plate (or left out on a mini map if there is no room).
   Links are hairlines inside a group, faint; a dot's links light up on hover. Hover or tap a dot: its card. Tap a
   group name: the camera moves to the group, every item is named and listed in the card; tap outside: back.
   mini: a small, quiet map without controls (the desk home and the sidebar); a click calls onClick. labels: false
   leaves the group names off a mini map.
   sample: nothing of your own yet; the small example is shown, and hovering or tapping a dot explains what it would be
   in your workspace and offers the real action.
   Life: rarely, a faint pulse travels along a real link inside a group, only on the full map (never the mini maps)
   while it is on screen and the page is visible, never with reduced motion. Pulse frames copy the cached picture. */
(function () {
  'use strict';
  const GW = window.WSGRAPH;
  const COL = { aircraft: '#FFFFFF', doc: '#A9C7E6', page: '#6F8DB0', note: '#DCE8F4', notebook: '#C3D5E8', pack: '#E6D9BD', route: '#9CCFC7', desk: '#7E8C9C' };
  const COLS = COL;
  /* the cloud (Ice): blob light, group names */
  const ICE = { core: '104,156,228', puff: '86,136,214', wash: '60,104,176' };
  const LEG = { aircraft: 'aircraft', doc: 'doc', note: 'note', pack: 'pack', route: 'route', desk: 'desk' };
  const BASE = { aircraft: 4.6, doc: 3.4, page: 1.8, note: 2.8, notebook: 2.9, pack: 3, route: 3, desk: 2.8 };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sprites = {};
  function sprite(c) {
    if (sprites[c]) return sprites[c];
    const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, c); g.addColorStop(0.18, c + 'AA'); g.addColorStop(0.45, c + '30'); g.addColorStop(1, c + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (sprites[c] = s);
  }
  const stats = { pulseFrames: 0 };
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function neighOf(g, i) { const s = new Set([i]); for (const l of g.links) { if (l.s === i) s.add(l.t); else if (l.t === i) s.add(l.s); } return s; }
  function names(t) {
    return { KN: { aircraft: t('Aircraft', 'Fly'), doc: t('Document', 'Dokument'), page: t('Page', 'Side'), note: t('Note', 'Notat'), notebook: t('Notebook', 'Notatbok'), pack: t('Briefing pack', 'Briefingpakke'), route: t('Route', 'Rute'), desk: t('Desk', 'Arbeidsflate') },
      GN: { aircraft: t('Aircraft', 'Fly'), doc: t('Documents', 'Dokumenter'), note: t('Notes', 'Notater'), pack: t('Packs', 'Pakker'), route: t('Routes', 'Ruter'), desk: t('Desks', 'Arbeidsflater') } };
  }
  /* the card for node i (2D and 3D maps): an example dot explains what it would be in your workspace and offers the real
     action (when pinned); your own dot offers to open it on the desk. o: { t, sample, pinned, coarse } */
  function cardHTML(g, i, o) {
    const t = o.t, KN = names(t).KN, COL = o.col || COLS;
    const ACT = { aircraft: ['ac-new', t('Add aircraft', 'Legg til fly')], doc: ['doc-add', t('Add a document', 'Legg til et dokument')], page: ['doc-add', t('Add a document', 'Legg til et dokument')], note: ['map-note', t('New note', 'Nytt notat')], notebook: ['map-note', t('New note', 'Nytt notat')], pack: ['pack-new', t('Make a briefing pack', 'Lag en briefingpakke')], route: ['', t('Plan a route', 'Planlegg en rute')] };
    const ART = { aircraft: ['an aircraft', 'et fly'], doc: ['a document', 'et dokument'], page: ['a page reference', 'en sidehenvisning'], note: ['a note', 'et notat'], notebook: ['a notebook', 'en notatbok'], pack: ['a briefing pack', 'en briefingpakke'], route: ['a route', 'en rute'], desk: ['a desk', 'en arbeidsflate'] };
    const WOULD = k => { const a = ART[k] || ART.note; return t(`Example — this is where ${a[0]} would go`, `Eksempel — her hører ${a[1]} hjemme`); };
    function explain(g, i, t) {
      const n = g.nodes[i], nb2 = [...neighOf(g, i)].filter(j => j !== i).map(j => g.nodes[j]), of = k => nb2.filter(m => m.k === k).map(m => m.label);
      const q = s => t('“', '«') + s + t('”', '»'), list = a => a.slice(0, 2).join(t(' and ', ' og ')) + (a.length > 2 ? t(` and ${a.length - 2} more`, ` og ${a.length - 2} til`) : '');
      const ac = n.ac && g.index[n.ac] != null && n.k !== 'aircraft' ? g.nodes[g.index[n.ac]].label : '';
      if (n.k === 'aircraft') return t(`An aircraft you fly${n.type ? ', a ' + n.type : ''}. It gets its own cloud on the map, where its documents, notes and briefing packs gather.`, `Et fly du flyr${n.type ? ', en ' + n.type : ''}. Det får sin egen sky på kartet, der dokumentene, notatene og briefingpakkene samles.`);
      if (n.k === 'doc') { const ns = of('note'); return (ac ? t(`Your ${n.label}, filed under ${ac}.`, `Din ${n.label}, lagt under ${ac}.`) : t(`A document like ${n.label}.`, `Et dokument som ${n.label}.`)) + (ns.length ? t(` Notes that cite its pages link here, like ${q(ns[0])}.`, ` Notater som viser til sidene, kobles hit, som ${q(ns[0])}.`) : t(' Notes that cite its pages link here.', ' Notater som viser til sidene, kobles hit.')); }
      if (n.k === 'page') { const ns = of('note'); return ns.length ? t(`A page in your manual that a note refers to: ${q(ns[0])} cites it.`, `En side i manualen din som et notat viser til: ${q(ns[0])} viser til den.`) : t('A page in your manual that a note refers to.', 'En side i manualen din som et notat viser til.'); }
      if (n.k === 'note' || n.k === 'notebook') { const ps = of('page').concat(of('doc')); return ps.length ? t(`A note of your own. This one cites a page in ${list(ps)}.`, `Et notat du skriver selv. Dette viser til en side i ${list(ps)}.`) : t(`A note of your own${ac ? ', linked to ' + ac : ''}.`, `Et notat du skriver selv${ac ? ', koblet til ' + ac : ''}.`); }
      if (n.k === 'pack') { const r = of('route'); return t(`Briefing pack ${n.label.replace(' – ', '→')}${r.length ? ', linked to its route' : ''}${ac ? ' and to ' + ac : ''}.`, `Briefingpakke ${n.label.replace(' – ', '→')}${r.length ? ', koblet til ruten sin' : ''}${ac ? ' og til ' + ac : ''}.`); }
      if (n.k === 'route') { const pk = of('pack'); return t(`A route from Route Explorer${pk.length ? ', linked to the briefing pack ' + pk[0].replace(' – ', '→') : ''}.`, `En rute fra Route Explorer${pk.length ? ', koblet til briefingpakken ' + pk[0].replace(' – ', '→') : ''}.`); }
      return '';
    }
    const n = g.nodes[i], sub = n.k === 'aircraft' && n.type ? `<span class="m">${esc(n.type)}</span>` : '';
    if (o.sample) {
      const a = ACT[n.k];
      return `<span class="k"><i style="background:${COL[n.k]}"></i>${esc(KN[n.k])} · ${esc(t('Example', 'Eksempel'))}</span><b>${esc(n.label)}</b>${sub}<span class="w">${esc(WOULD(n.k))}</span><span class="x">${esc(explain(g, i, t))}</span>` +
        (o.pinned ? `<span class="b">${a ? (a[0] ? `<button type="button" class="btn sm pri" data-act="${a[0]}">${esc(a[1])}</button>` : `<a class="btn sm pri" href="route.html">${esc(a[1])}</a>`) : ''}</span>` : `<span class="m">${esc(o.coarse ? t('Tap to add your own', 'Trykk for å legge til ditt eget') : t('Click to add your own', 'Klikk for å legge til ditt eget'))}</span>`);
    }
    return `<span class="k"><i style="background:${COL[n.k]}"></i>${esc(KN[n.k])}</span><b>${esc(n.label)}</b>${sub}<span class="m">${esc(n.deg === 1 ? t('1 link', '1 kobling') : t(n.deg + ' links', n.deg + ' koblinger'))}</span>` +
      `<span class="b"><button type="button" class="btn sm pri" data-o="here">${esc(t('Open on the desk', 'Åpne på arbeidsflaten'))}</button><button type="button" class="btn sm" data-o="beside">${esc(t('Open beside', 'Åpne ved siden av'))}</button>` +
      (o.edit && o.pinned && MOVABLE[n.k] ? `<button type="button" class="btn sm" data-mv aria-haspopup="menu">${esc(t('Move to', 'Flytt til'))} ▾</button>` : '') + `</span>`;
  }
  /* what can be placed in a group by hand (the same menu as the chip on the desk) */
  const MOVABLE = { doc: 1, note: 1, notebook: 1, pack: 1, route: 1 };
  /* a click on the card's own-map actions: "Move to" on a dot, "New note here" (and Rename, Delete for a topic) on a
     group. o.onEdit(what: 'move' | 'new' | 'rename' | 'delete', node or group, the button). -> true when it was one */
  function cardAct(e, o, node, grp) {
    const b = e.target.closest('[data-mv],[data-ga]'); if (!b) return false;
    if (!o.onEdit) return true;
    if (b.hasAttribute('data-mv')) { if (node) o.onEdit('move', node, b); } else if (grp) o.onEdit(b.dataset.ga, grp, b);
    return true;
  }
  /* the card of a focused group (2D and 3D): its name and count, "New note here" and back to all, every item in it (a
     button each); a topic of your own can be renamed and deleted. items: node indices; o: { t, sample, col, name, sub, edit, topic } */
  function groupCardHTML(g, items, o) {
    const t = o.t, KN = names(t).KN, COL = o.col || COLS;
    return `<span class="k">${esc(o.sample ? t('Example group', 'Eksempelgruppe') : t('Group', 'Gruppe'))}</span><b class="gh">${esc(o.name)} <span class="gc">· ${items.filter(i => g.nodes[i].k !== 'aircraft').length}</span></b>${o.sub ? `<span class="m">${esc(o.sub)}</span>` : ''}` +
      `<span class="b">${o.edit ? `<button type="button" class="btn sm pri" data-ga="new">${esc(t('+ New note here', '+ Nytt notat her'))}</button>` : ''}<button type="button" class="btn sm" data-back>${esc(t('← All groups', '← Alle grupper'))}</button></span>` +
      `<ul class="gl">${items.map(i => `<li><button type="button" data-i="${i}"><i style="background:${COL[g.nodes[i].k]}"></i><span>${esc(g.nodes[i].label)}</span><small>${esc(KN[g.nodes[i].k])}</small></button></li>`).join('')}</ul>` +
      (o.edit && o.topic ? `<span class="ge"><button type="button" class="lnk" data-ga="rename">${esc(t('Rename', 'Gi nytt navn'))}</button><button type="button" class="lnk" data-ga="delete">${esc(t('Delete', 'Slett'))}</button></span>` : '');
  }
  /* search on the map: node indices best first (at most 7) */
  function searchRows(g, q, visible) {
    q = fold(q.trim()); if (!q) return [];
    const tk = q.split(/\s+/), rows = [];
    g.nodes.forEach((n, i) => { if (!visible(i)) return; const f = fold(n.label + (n.type ? ' ' + n.type : '')); if (tk.every(x => f.includes(x))) rows.push([i, (f.startsWith(q) ? 0 : 1) + (n.k === 'page' ? 1 : 0)]); });
    rows.sort((a, b) => a[1] - b[1] || g.nodes[b[0]].deg - g.nodes[a[0]].deg); return rows.slice(0, 7).map(r => r[0]);
  }
  /* the 2D / 3D switch on the map toolbar: view { cur: '2d' | '3d', onSwitch(mode) } */
  function viewSwitch(view, t) {
    if (!view) return '';
    return `<div class="wsm-zm wsm-vw" role="group" aria-label="${esc(t('Map view', 'Kartvisning'))}">${['2d', '3d'].map(m => `<button type="button" data-view="${m}" aria-pressed="${view.cur === m}">${m.toUpperCase()}</button>`).join('')}</div>`;
  }

  function mount(host, o) {
    const t = o.t || ((en) => en), mini = !!o.mini, showNames = o.labels !== false;
    const KN = names(t).KN, GN = names(t).GN;
    host.classList.add('wsm'); if (mini) host.classList.add('mini');
    host.innerHTML = `<canvas class="wsm-c"${mini ? ' aria-hidden="true"' : ` tabindex="0" role="img" aria-roledescription="${esc(t('map', 'kart'))}"`}></canvas>` + (mini ? '' : `
      <div class="wsm-top">
        <div class="wsm-q"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2"/><path d="M12.6 12.6 17 17"/></svg><input type="search" class="wsm-qi" placeholder="${esc(t('Find on the map', 'Finn på kartet'))}" aria-label="${esc(t('Find on the map', 'Finn på kartet'))}" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list"><ul class="wsm-sug" role="listbox" hidden></ul></div>
        <span class="sp"></span>
        <div class="wsm-zm"><button type="button" data-z="in" aria-label="${esc(t('Zoom in', 'Zoom inn'))}">+</button><button type="button" data-z="out" aria-label="${esc(t('Zoom out', 'Zoom ut'))}">−</button><button type="button" data-z="fit">${esc(t('Fit', 'Tilpass'))}</button></div>${viewSwitch(o.view, t)}
      </div>
      <div class="wsm-card" hidden></div>
      <div class="wsm-grps" role="group" aria-label="${esc(t('Groups', 'Grupper'))}"></div>
      <div class="wsm-leg" role="group" aria-label="${esc(t('Show on the map', 'Vis på kartet'))}"></div>`);
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
    const card = host.querySelector('.wsm-card'), legEl = host.querySelector('.wsm-leg'), qi = host.querySelector('.wsm-qi'), sug = host.querySelector('.wsm-sug'), grpEl = host.querySelector('.wsm-grps');
    let g = null, L = null, W = 0, H = 0, dpr = 1, alive = true, raf = 0, auto = true, fitK = 1;
    const cam = { x: 0, y: 0, k: 1 };
    let hover = -1, sel = -1, gsel = -1, hoverG = -1, tween = null, hidden = new Set(), nb = null, drag = null, glab = [];
    const dbg = { frames: 0, draws: 0, pulseFrames: 0, regions: [], labels: [], groupLabels: [], get gsel() { return gsel; }, get pulses() { return pulses.length; }, get running() { return !!raf; }, get settled() { return !L || L.settled; } };
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let dirty = true, pulses = [], shown = null, scene = null, sceneOK = false, ambT = 0, pulseT = 0, onScreen = true;
    /* an example dot (nothing of your own yet): explained, never opened */
    const isEx = i => i >= 0 && !!g.nodes[i] && !!o.sample;
    const canEdit = !o.sample && !!o.onEdit;
    const aspect = () => W && H ? Math.max(0.4, Math.min(3, (W - (mini ? 20 : 48)) / Math.max(60, H - (mini ? 38 : 58 + (o.padBottom || 64))))) : 1.6;

    /* ---------- data ---------- */
    let names2 = [];
    function setGraph(ng, keep) {
      g = ng; L = GW.cloudLayout(g, { aspect: aspect(), instant: !!keep || reduced() }); pulses = [];
      names2 = L.groups.map(q => GW.groupName(g, L.groups, q, t)); dbg.regions = names2.slice();
      hover = -1; sel = -1; gsel = -1; nb = null; if (card) card.hidden = true;
      auto = true; request();
      drawLegend(); drawGroupButtons(); host.setAttribute('data-nodes', g.nodes.length);
      if (!mini) cv.setAttribute('aria-label', t('Map of your workspace: ', 'Kart over arbeidsområdet ditt: ') + names2.map((s, k) => s + ' ' + L.groups[k].n).join(', ') + '. ' + legendText());
    }
    /* the cloud follows the plate's shape: laid out again when a resize changes it enough to want other rows */
    function reshape() {
      if (!g) return; const n2 = GW.cloudLayout(g, { aspect: aspect(), instant: L.settled });
      if (n2.cols === L.cols) return; L = n2; if (gsel >= 0) gsel = -1; showCard(sel); nb = null;
    }
    const visible = i => !hidden.has(g.nodes[i].g);
    const legendText = () => GW.GROUPS.filter(k => g.counts[k] || hidden.has(k)).map(k => GN[k] + ' ' + g.counts[k]).join(' · ');
    function drawLegend() {
      if (!legEl) return;
      legEl.innerHTML = GW.GROUPS.filter(k => g.counts[k] || hidden.has(k)).map((k, i) => `${i ? '<span class="dot" aria-hidden="true">·</span>' : ''}<button type="button" data-g="${k}" aria-pressed="${!hidden.has(k)}"><i style="background:${COL[k]}"></i>${esc(GN[k])} <b>${g.counts[k]}</b></button>`).join('');
    }
    /* the group names as buttons for the keyboard and screen readers (the canvas draws them; these are visually hidden) */
    function drawGroupButtons() {
      if (!grpEl) return;
      grpEl.innerHTML = L.groups.map((q, k) => `<button type="button" data-k="${k}">${esc(names2[k])} · ${q.n}</button>`).join('');
    }

    /* ---------- camera ---------- */
    const sx = i => (L.x[i] - cam.x) * cam.k + W / 2, sy = i => (L.y[i] - cam.y) * cam.k + H / 2;
    const wsx = x => (x - cam.x) * cam.k + W / 2, wsy = y => (y - cam.y) * cam.k + H / 2;
    const toWorld = (px, py) => [(px - W / 2) / cam.k + cam.x, (py - H / 2) / cam.k + cam.y];
    const pads = () => ({ l: mini ? 10 : 24, r: mini ? 10 : 24, t: mini ? (showNames ? 26 : 8) : 58, b: mini ? 34 : (o.padBottom || 64) });
    function fitBox(b, p, cap) {
      const bw = Math.max(60, b.x1 - b.x0), bh = Math.max(60, b.y1 - b.y0);
      const k = Math.max(0.05, Math.min((W - p.l - p.r) / bw, Math.max(80, H - p.t - p.b) / bh, cap));
      return { x: (b.x0 + b.x1) / 2 - (p.l - p.r) / 2 / k, y: (b.y0 + b.y1) / 2 - (p.t - p.b) / 2 / k, k };
    }
    function fitTarget() { return fitBox(L.frame, pads(), mini ? 2.2 : 2.6); }
    /* a focused group: its blob and name fill the free part of the plate (beside the card on a wide plate, under it on a narrow one) */
    function groupTarget(k) {
      const q = L.groups[k], R = q.r + L.D * 1.1, p = pads();
      if (card && !card.hidden) { if (W >= 600) p.l = card.offsetLeft + card.offsetWidth + 16; else if (card.offsetTop + card.offsetHeight > H * 0.75) p.b = Math.max(p.b, H - card.offsetTop + 12); else p.t = Math.max(p.t, card.offsetTop + card.offsetHeight + 12); }
      return fitBox({ x0: q.cx - R, x1: q.cx + R, y0: q.cy - R - L.D * 1.3, y1: q.cy + R }, p, fitK * 4);
    }
    function fitNow() { if (!W) return; const f = fitTarget(); cam.x = f.x; cam.y = f.y; cam.k = f.k; fitK = f.k; }
    function moveTo(tg, ms) {
      auto = false;
      if (reduced() || !ms) { tween = null; Object.assign(cam, tg); request(); return; }
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
      if (!L.settled) { full = true; L.step(mini ? 3 : 2); more = true; }
      if (auto) { full = true; const f = fitTarget(); fitK = f.k; if (Math.abs(f.k - cam.k) / f.k > 0.002 || Math.hypot(f.x - cam.x, f.y - cam.y) * cam.k > 0.3) { cam.x += (f.x - cam.x) * 0.2; cam.y += (f.y - cam.y) * 0.2; cam.k += (f.k - cam.k) * 0.2; more = true; } else { Object.assign(cam, f); if (L.settled) auto = false; } }
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
        const a = Math.sin(Math.PI * Math.min(1, e)) * p.s, tl = Math.max(0, u - 0.28), tx = ax + (bx - ax) * tl, ty = ay + (by - ay) * tl, r = 7 * (0.7 + 0.3 * p.s);
        list.push({ tx, ty, qx, qy, a, r }); box = union(box, [Math.min(tx, qx) - r, Math.min(ty, qy) - r, Math.max(tx, qx) + r, Math.max(ty, qy) + r]);
      }
      return { list, box };
    }
    function drawPulses(ops) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const spr = sprite('#DCEBFA');
      for (const { tx, ty, qx, qy, a, r } of ops.list) {
        const gr = ctx.createLinearGradient(tx, ty, qx, qy); gr.addColorStop(0, 'rgba(214,232,250,0)'); gr.addColorStop(1, 'rgba(214,232,250,' + (0.5 * a).toFixed(3) + ')');
        ctx.strokeStyle = gr; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(qx, qy); ctx.stroke();
        ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, qx - r, qy - r, r * 2, r * 2); ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const inner = l => L.gi[l.s] === L.gi[l.t];
    const canPulse = () => alive && !mini && onScreen && L && L.settled && !drag && !reduced() && g.links.some(inner) && (typeof document === 'undefined' || document.visibilityState === 'visible');
    function kick() { if (!raf && !pulseT && alive) raf = requestAnimationFrame(frame); }
    /* from a touched node: its links light up one after the other, then it stops */
    function burst(i) {
      if (mini || reduced() || i < 0) return; const now = performance.now(); let n = 0;
      for (const l of g.links) { const b = l.s === i ? l.t : l.t === i ? l.s : -1; if (b < 0 || !visible(b) || n >= 12) continue; pulses.push({ a: i, b, t0: now + n * 60, dur: 520, s: 0.85 }); n++; }
      kick();
    }
    /* now and then: a faint pulse along a random link inside a group */
    function ambient() {
      ambT = 0; if (!canPulse()) return;
      const ls = g.links.filter(l => inner(l) && visible(l.s) && visible(l.t)); if (!ls.length) return;
      const l = ls[Math.floor(Math.random() * ls.length)], a = Math.random() < 0.5 ? l.s : l.t;
      pulses.push({ a, b: a === l.s ? l.t : l.s, t0: performance.now(), dur: 1100 + Math.random() * 300, s: 0.5 });
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
      const first = !W, atFit = Math.abs(cam.k - fitK) / fitK < 0.01; W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); bg = null;
      reshape();
      if (first || auto || (!drag && !tween && atFit && gsel < 0)) { fitNow(); }
      draw();
    }
    let bg = null;
    function draw() {
      if (!W || !g) return; dbg.draws++; sceneOK = false;
      if (L.settled && !ambT) schedule();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (!bg || bg.w !== W || bg.h !== H) { /* a deep night blue, drawn once into a cached canvas */
        const c = document.createElement('canvas'); c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); const b = c.getContext('2d'); b.scale(dpr, dpr);
        const gr = b.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75); gr.addColorStop(0, '#0B1D37'); gr.addColorStop(0.55, '#071629'); gr.addColorStop(1, '#040C19');
        b.fillStyle = gr; b.fillRect(0, 0, W, H); bg = { c, w: W, h: H };
      }
      ctx.drawImage(bg.c, 0, 0, W, H);
      drawCloud();
      const N = g.nodes.length, zk = cam.k / (fitK || 1), focus = hover >= 0 ? hover : sel, near = focus >= 0 ? (nb && nb.i === focus ? nb.s : (nb = { i: focus, s: neighOf(g, focus) }).s) : null;
      const sizeK = Math.min(1.8, Math.max(0.8, Math.sqrt(zk))) * (mini ? 0.8 : W < 600 ? 0.9 : 1);
      const px = new Float32Array(N), py = new Float32Array(N), pr = new Float32Array(N), vis = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (!visible(i)) continue; const n = g.nodes[i];
        px[i] = sx(i); py[i] = sy(i); pr[i] = (BASE[n.k] || 2) * sizeK;
        vis[i] = px[i] > -40 && px[i] < W + 40 && py[i] > -40 && py[i] < H + 40 ? 1 : 0;
      }
      const dimOf = i => (near && !near.has(i)) || (gsel >= 0 && L.gi[i] !== gsel);
      /* links: inside a group only, as faint hairlines; a focused dot's links (any) brighter */
      ctx.lineWidth = mini ? 0.5 : 0.8; ctx.lineCap = 'round'; ctx.strokeStyle = near ? 'rgba(150,182,218,.035)' : 'rgba(170,200,236,' + (mini ? 0.05 : 0.065) + ')'; ctx.beginPath();
      const hl = [];
      for (const l of g.links) { if (!visible(l.s) || !visible(l.t) || !(vis[l.s] || vis[l.t])) continue; if (near && (l.s === focus || l.t === focus)) { hl.push(l); continue; } if (!inner(l) || (gsel >= 0 && L.gi[l.s] !== gsel)) continue; ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }
      ctx.stroke();
      if (hl.length) { ctx.strokeStyle = 'rgba(214,232,250,.55)'; ctx.lineWidth = 1.1; ctx.beginPath(); hl.forEach(l => { ctx.moveTo(px[l.s], py[l.s]); ctx.lineTo(px[l.t], py[l.t]); }); ctx.stroke(); }
      /* a soft halo, then the dots, one path per colour */
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i], r = pr[i] * (n.k === 'aircraft' ? 3.6 : 2.8); ctx.globalAlpha = (dimOf(i) ? 0.12 : 1) * 0.38; ctx.drawImage(sprite(COL[n.k]), px[i] - r, py[i] - r, r * 2, r * 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      for (const k in COL) {
        for (const dim of [false, true]) {
          ctx.beginPath(); let any = false;
          for (let i = 0; i < N; i++) { if (!vis[i] || g.nodes[i].k !== k || dimOf(i) !== dim) continue; ctx.moveTo(px[i] + pr[i], py[i]); ctx.arc(px[i], py[i], pr[i], 0, Math.PI * 2); any = true; }
          if (any) { ctx.globalAlpha = dim ? 0.3 : 0.92; ctx.fillStyle = COL[k]; ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
      /* rings: aircraft, annotated documents, the focused dot */
      ctx.lineWidth = mini ? 0.6 : 0.9;
      for (let i = 0; i < N; i++) { if (!vis[i]) continue; const n = g.nodes[i]; if (n.k === 'aircraft' || n.ink) { ctx.strokeStyle = n.k === 'aircraft' ? 'rgba(255,255,255,' + (dimOf(i) ? 0.1 : 0.32) + ')' : 'rgba(169,199,230,.45)'; ctx.beginPath(); ctx.arc(px[i], py[i], pr[i] + (n.k === 'aircraft' ? (mini ? 2.2 : 3.6) : 2.2), 0, Math.PI * 2); ctx.stroke(); } }
      if (focus >= 0 && vis[focus]) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px[focus], py[focus], pr[focus] + 3.5, 0, Math.PI * 2); ctx.stroke(); }
      /* names: the groups first (they never collide and never leave the plate), then dots when there is room */
      const taken = [];
      for (let i = 0; i < N; i++) if (vis[i]) taken.push([px[i] - pr[i] - 2, py[i] - pr[i] - 2, px[i] + pr[i] + 2, py[i] + pr[i] + 2]);
      const dots = taken.length;
      dbg.labels = [];
      drawGroupNames(taken, dots, sizeK);
      if (mini) return;
      const narrow = W < 600, P = pads();
      const free = (x0, y0, x1, y1) => { if (x0 < 4 || x1 > W - 4 || y0 < P.t - 6 || y1 > H - P.b + 10) return false; for (const r of taken) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false; return true; };
      const label = (i, mode) => { /* mode: 'focus' | '' */
        const n = g.nodes[i], strong = mode === 'focus', cap = strong ? (narrow ? 30 : 44) : narrow ? 22 : 30, raw = n.label, s = raw.length > cap ? raw.slice(0, cap - 1).trimEnd() + '…' : raw;
        ctx.font = strong ? '600 12.5px Public Sans, system-ui, sans-serif' : (narrow ? '500 11.5px ' : '500 12px ') + 'Public Sans, system-ui, sans-serif';
        const w = ctx.measureText(s).width;
        /* right of the dot, else left, else above or below it */
        const cand = [[px[i] + pr[i] + 6, py[i]], [px[i] - pr[i] - 6 - w, py[i]], [px[i] - w / 2, py[i] - pr[i] - 13], [px[i] - w / 2, py[i] + pr[i] + 13]];
        let x = 0, y = 0, ok = false;
        for (const [cx, cy] of cand) if (free(cx - 3, cy - 9, cx + w + 3, cy + 9)) { x = cx; y = cy; ok = true; break; }
        if (!ok) { if (!strong) return; x = Math.max(6, Math.min(W - w - 6, cand[0][0])); y = py[i]; }
        taken.push([x - 3, y - 9, x + w + 3, y + 9]);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (strong) { ctx.fillStyle = 'rgba(3,10,22,.86)'; roundRect(x - 5, y - 11, w + 10, 22, 4); ctx.fill(); }
        else { ctx.fillStyle = 'rgba(3,10,22,.55)'; roundRect(x - 4, y - 9, w + 8, 18, 4); ctx.fill(); }
        ctx.fillStyle = strong ? '#FFFFFF' : 'rgba(226,236,248,.92)';
        ctx.fillText(s, x, y); dbg.labels.push(n.id);
      };
      if (focus >= 0 && vis[focus]) label(focus, 'focus');
      const order = [];
      for (let i = 0; i < N; i++) {
        if (!vis[i] || i === focus) continue;
        if ((gsel >= 0 && L.gi[i] === gsel) || (near && near.has(i)) || (gsel < 0 && !near && zk >= 2.6)) order.push(i);
      }
      const RK = { aircraft: 0, doc: 1, pack: 2, route: 3 };
      order.sort((a, b) => (RK[g.nodes[a].k] ?? 4) - (RK[g.nodes[b].k] ?? 4) || g.nodes[b].deg - g.nodes[a].deg || a - b);
      order.slice(0, 160).forEach(i => label(i, ''));
    }
    /* what lies over the plate (the example tag, the call to action, the card), in canvas pixels: names keep off it */
    function overlays() {
      const pl = host.closest('.wsm-plate') || host, c = cv.getBoundingClientRect(), out = [];
      pl.querySelectorAll('.wsm-tag, .wsm-cta, .wsm-card').forEach(e => { if (e.hidden) return; const r = e.getBoundingClientRect(); if (r.width) out.push([r.left - c.left - 4, r.top - c.top - 4, r.right - c.left + 4, r.bottom - c.top + 4]); });
      return out;
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    /* ---------- the cloud: soft puffs of light per group, no outline ---------- */
    function drawCloud() {
      if (!L.groups.length) return;
      const k = cam.k, f = L.frame, cx = wsx((f.x0 + f.x1) / 2), cy = wsy((f.y0 + f.y1) / 2), R = Math.max(f.x1 - f.x0, f.y1 - f.y0) * 0.6 * k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      /* one faint wash under the whole cloud, so the blobs read as one */
      let gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, `rgba(${ICE.wash},.14)`); gr.addColorStop(0.55, `rgba(${ICE.wash},.06)`); gr.addColorStop(1, `rgba(${ICE.wash},0)`);
      ctx.fillStyle = gr; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      L.groups.forEach((q, gi) => {
        const lit = gsel < 0 ? (hoverG === gi ? 1.35 : 1) : gsel === gi ? 1.25 : 0.35;
        q.puffs.forEach((p, j) => {
          const x = wsx(p.x), y = wsy(p.y), r = p.r * k; if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) return;
          const a = (j ? 0.07 : 0.12) * lit, c = j ? ICE.puff : ICE.core;
          gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a.toFixed(3)})`); gr.addColorStop(0.45, `rgba(${c},${(a * 0.62).toFixed(3)})`); gr.addColorStop(0.75, `rgba(${c},${(a * 0.22).toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        });
      });
      ctx.restore();
    }
    /* each group's name and count, in a quiet pill: above its dots, else below, else nudged sideways; never over a dot
       or another name, never off the plate. On a mini map a name with no room is left out. */
    function drawGroupNames(taken, dots, sizeK) {
      glab = []; dbg.groupLabels = [];
      if (mini && !showNames) return;
      const P = pads(), fs = mini ? (W < 300 ? 10 : W >= 360 ? 12 : 11) : W < 600 ? 12.5 : 13.5, h = Math.round(fs + (mini ? 8 : 11)), padX = mini ? 6 : 9;
      const top = mini ? 4 : P.t - 4, bot = H - (mini ? 30 : P.b - 6), k = cam.k;
      if (!mini) overlays().forEach(r => taken.push(r));
      const hitAny = (x0, y0, x1, y1) => { for (const r of taken) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return true; return false; };
      ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const fN = `600 ${fs}px IBM Plex Mono, ui-monospace, monospace`, fC = `500 ${fs}px IBM Plex Mono, ui-monospace, monospace`, ls = mini ? 0.8 : 1.4;
      const meas = (s, f) => { ctx.font = f; if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; return ctx.measureText(s).width; };
      const order = L.groups.map((q, gi) => gi).sort((a, b) => (a === gsel ? -1 : b === gsel ? 1 : 0) || L.groups[b].m.length - L.groups[a].m.length);
      for (const gi of order) {
        const q = L.groups[gi], name = names2[gi].toUpperCase(), cnt = ' · ' + q.n;
        if (q.m.length && !q.m.some(i => visible(i))) continue;
        const wn = meas(name, fN), wc = meas(cnt, fC), w = Math.ceil(wn + wc + padX * 2 + (mini ? 6 : 0));
        const cx = wsx(q.cx), cy = wsy(q.cy), rs = q.r * k + 4.6 * sizeK + 5;
        const cand = [];
        for (const y of [cy - rs - h / 2 - 2, cy + rs + h / 2 + 2]) for (const dx of [0, -0.6, 0.6, -1.2, 1.2]) cand.push([cx + dx * w, y]);
        let at = null;
        for (const [x, y] of cand) {
          const x0 = Math.max(12, Math.min(W - 12 - w, x - w / 2)), y0 = y - h / 2;
          if (y0 < top || y0 + h > bot) continue;
          if (hitAny(x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2)) continue;
          at = [x0, y0]; break;
        }
        if (!at) continue;
        const [x0, y0] = at, on = gsel === gi || hoverG === gi;
        ctx.globalAlpha = gsel >= 0 && !on ? 0.55 : 1;
        ctx.fillStyle = on ? 'rgba(14,38,70,.92)' : 'rgba(4,13,28,.66)'; roundRect(x0, y0, w, h, h / 2); ctx.fill();
        ctx.strokeStyle = on ? 'rgba(200,224,250,.5)' : 'rgba(190,215,245,.16)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = fN; if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; ctx.fillStyle = q.ac < 0 ? 'rgba(226,236,248,.86)' : '#F3F8FE'; ctx.fillText(name, x0 + padX, y0 + h / 2 + 0.5);
        ctx.font = fC; ctx.fillStyle = 'rgba(190,212,238,.78)'; ctx.fillText(cnt, x0 + padX + wn, y0 + h / 2 + 0.5);
        taken.push([x0, y0, x0 + w, y0 + h]);
        glab.push({ k: gi, x0, y0, x1: x0 + w, y1: y0 + h });
        dbg.groupLabels.push({ name: names2[gi], text: names2[gi] + cnt, x0, y0, x1: x0 + w, y1: y0 + h });
      }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    }

    /* ---------- pointer: pan, pinch, wheel, click ---------- */
    function hit(x, y) {
      let best = -1, bd = Infinity; const zk = cam.k / (fitK || 1), sk = Math.min(1.8, Math.max(0.8, Math.sqrt(zk)));
      for (let i = 0; i < g.nodes.length; i++) { if (!visible(i)) continue; const dx = sx(i) - x, dy = sy(i) - y, d = dx * dx + dy * dy, r = (BASE[g.nodes[i].k] || 2) * sk + (coarse ? 11 : 7); if (d < r * r && d < bd) { bd = d; best = i; } }
      return best;
    }
    const hitG = (x, y) => { for (const r of glab) if (x >= r.x0 - 4 && x <= r.x1 + 4 && y >= r.y0 - 4 && y <= r.y1 + 4) return r.k; return -1; };
    const pts = new Map(); let pinch = null, moved = 0;
    const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function down(e) {
      if (mini) return;
      cv.setPointerCapture(e.pointerId); const [x, y] = local(e); pts.set(e.pointerId, [x, y]); moved = 0; tween = null;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; return; }
      drag = { x, y, sx: x, sy: y, shift: e.shiftKey || e.altKey };
    }
    function move(e) {
      const [x, y] = local(e);
      if (mini) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; cam.x -= (m[0] - pinch.m[0]) / cam.k; cam.y -= (m[1] - pinch.m[1]) / cam.k; zoomAt(d / (pinch.d || d), m[0], m[1]); pinch = { d, m }; moved = 99; return; }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y; moved = Math.max(moved, Math.hypot(x - drag.sx, y - drag.sy)); if (moved < 4) return;
        auto = false; cam.x -= dx / cam.k; cam.y -= dy / cam.k; cv.style.cursor = 'grabbing';
        drag.x = x; drag.y = y; request(); return;
      }
      if (e.pointerType === 'touch') return;
      const i = hit(x, y), k = i < 0 ? hitG(x, y) : -1;
      if (k !== hoverG) { hoverG = k; request(); }
      if (i !== hover) { const was = hover; hover = i; if (i >= 0) { showCard(i); if (isEx(i)) burst(i); } else if (was >= 0) showCard(sel); request(); }
      cv.style.cursor = i >= 0 || k >= 0 ? 'pointer' : '';
    }
    function up(e) {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
      const d = drag; drag = null; cv.style.cursor = hover >= 0 || hoverG >= 0 ? 'pointer' : '';
      if (!d || moved >= 4) return;
      const [x, y] = local(e), k = hitG(x, y), i = k < 0 ? hit(x, y) : -1;
      if (k >= 0) { focusGroup(k === gsel && sel < 0 ? -1 : k); return; }
      if (i >= 0) { if (e.pointerType === 'touch' && !isEx(i)) { select(i); return; } open(i, d.shift || e.shiftKey || e.altKey); return; }
      back();
    }
    /* tap outside: the card closes; a focused group goes back to the whole cloud */
    function back() { if (gsel >= 0) focusGroup(-1); else if (sel >= 0) select(-1); }
    function wheel(e) {
      if (mini) return; e.preventDefault();
      const [x, y] = local(e);
      const mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || mouse) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018) * (e.deltaMode === 1 ? 30 : 1)), x, y);
      else { auto = false; tween = null; cam.x += e.deltaX / cam.k; cam.y += e.deltaY / cam.k; request(); }
    }
    function leave() { let ch = false; if (hoverG >= 0) { hoverG = -1; ch = true; } if (hover >= 0 && !drag) { hover = -1; showCard(sel); ch = true; } if (ch) request(); }
    function open(i, beside) {
      const n = g.nodes[i]; if (!n) return;
      if (isEx(i)) { select(i); return; }
      if (o.onOpen) o.onOpen(n, !!beside);
    }
    /* the card: a dot (shared with the 3D map, WSMAP.ui.cardHTML), or the focused group's list */
    function showCard(i) {
      if (!card) return;
      /* a dot's card moves to the right side when the dot itself is under the card's usual place, so the card never covers the dot you point at */
      if (i >= 0) { card.classList.toggle('r', W >= 700 && gsel < 0 && sx(i) < 340 && sy(i) < 300); card.hidden = false; card.classList.remove('grp'); card.innerHTML = cardHTML(g, i, { t, sample: isEx(i), pinned: i === sel, coarse, edit: canEdit }) + (gsel >= 0 ? `<span class="bk"><button type="button" class="lnk" data-gl>${esc(t('← ', '← ') + names2[gsel])}</button></span>` : ''); return; }
      card.classList.remove('r');
      if (gsel >= 0) { const q = L.groups[gsel]; card.hidden = false; card.classList.add('grp'); card.innerHTML = groupCardHTML(g, q.m.filter(visible), { t, sample: !!o.sample, edit: canEdit, topic: q.topic, name: names2[gsel], sub: q.ac >= 0 && names2[gsel].indexOf(g.nodes[q.ac].label) < 0 ? g.nodes[q.ac].label + (g.nodes[q.ac].type ? ' · ' + g.nodes[q.ac].type : '') : '' }); return; }
      card.hidden = true;
    }
    function select(i, zoom) {
      const was = sel; sel = i; nb = null;
      showCard(i);
      if (isEx(i) && i !== was && i !== hover) burst(i);
      if (i >= 0 && zoom) moveTo({ x: L.x[i], y: L.y[i], k: Math.max(cam.k, fitK * 2.4) }, 520);
      request();
    }
    function focusGroup(k) {
      if (k >= L.groups.length) return;
      gsel = k; sel = -1; nb = null; showCard(-1);
      moveTo(k >= 0 ? groupTarget(k) : fitTarget(), 560);
      if (k < 0) auto = false;
    }
    if (card) card.addEventListener('click', e => {
      if (cardAct(e, o, sel >= 0 ? g.nodes[sel] : null, gsel >= 0 ? L.groups[gsel] : null)) return;
      const b = e.target.closest('[data-o]'); if (b && sel >= 0) { open(sel, b.dataset.o === 'beside'); return; }
      const li = e.target.closest('[data-i]'); if (li) { const i = +li.dataset.i; if (isEx(i) || coarse) select(i); else { hover = -1; select(i); } return; }
      if (e.target.closest('[data-back]')) { focusGroup(-1); return; }
      if (e.target.closest('[data-gl]')) { sel = -1; showCard(-1); request(); }
    });
    if (card) card.addEventListener('mouseover', e => { const li = e.target.closest('[data-i]'); const i = li ? +li.dataset.i : -1; if (i !== hover && gsel >= 0) { hover = i; request(); } });
    if (card) card.addEventListener('mouseleave', () => { if (hover >= 0 && gsel >= 0) { hover = -1; request(); } });
    if (grpEl) { grpEl.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) focusGroup(+b.dataset.k); });
      grpEl.addEventListener('focusin', e => { const b = e.target.closest('[data-k]'); if (b) { hoverG = +b.dataset.k; request(); } });
      grpEl.addEventListener('focusout', () => { hoverG = -1; request(); }); }
    function key(e) {
      if (e.target !== cv) return;
      const step = 60;
      if (e.key === '+' || e.key === '=') zoomAt(1.25, W / 2, H / 2); else if (e.key === '-') zoomAt(0.8, W / 2, H / 2);
      else if (e.key === '0') { gsel = -1; showCard(sel); moveTo(fitTarget(), 380); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { auto = false; cam.x += (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0) / cam.k; cam.y += (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) / cam.k; request(); }
      else if (e.key === 'Enter' && sel >= 0) open(sel, e.shiftKey || e.altKey);
      else if (e.key === 'Escape' && (sel >= 0 || gsel >= 0)) { if (sel >= 0) select(-1); else focusGroup(-1); }
      else return;
      e.preventDefault();
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('keydown', key);
    cv.addEventListener('dblclick', e => { if (mini) return; const [x, y] = local(e); if (hit(x, y) < 0 && hitG(x, y) < 0) zoomAt(1.8, x, y); });
    if (mini) cv.addEventListener('click', () => { if (o.onClick) o.onClick(); });

    /* ---------- toolbar, legend, search ---------- */
    if (!mini) {
      const vw = host.querySelector('.wsm-vw'); if (vw) vw.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b && b.dataset.view !== o.view.cur) o.view.onSwitch(b.dataset.view); });
      host.querySelector('.wsm-zm').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; if (b.dataset.z === 'fit') { if (gsel >= 0) { gsel = -1; showCard(sel); } moveTo(fitTarget(), 420); } else zoomAt(b.dataset.z === 'in' ? 1.4 : 1 / 1.4, W / 2, H / 2); });
      legEl.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g; if (hidden.has(k)) hidden.delete(k); else hidden.add(k); if (sel >= 0 && !visible(sel)) select(-1); hover = -1; nb = null; drawLegend(); if (gsel >= 0 && sel < 0) showCard(-1); const nb2 = legEl.querySelector(`[data-g="${k}"]`); if (nb2) nb2.focus(); request(); });
      let rows = [], cur = 0;
      const drawSug = () => {
        const q = fold(qi.value.trim()); rows = searchRows(g, q, visible);
        cur = 0; sug.hidden = !rows.length && !q; qi.setAttribute('aria-expanded', String(!sug.hidden));
        sug.innerHTML = rows.length ? rows.map((i, k) => `<li role="option" id="wsmo${k}" data-i="${i}" aria-selected="${k === cur}"><i style="background:${COL[g.nodes[i].k]}"></i><span>${esc(g.nodes[i].label)}</span><small>${esc(KN[g.nodes[i].k])}</small></li>`).join('') : `<li class="none">${esc(t('Nothing on the map matches.', 'Ingenting på kartet passer.'))}</li>`;
        if (rows.length) qi.setAttribute('aria-activedescendant', 'wsmo0'); else qi.removeAttribute('aria-activedescendant');
      };
      const mark = () => sug.querySelectorAll('[role="option"]').forEach((li, k) => { li.setAttribute('aria-selected', String(k === cur)); if (k === cur) qi.setAttribute('aria-activedescendant', li.id); });
      const pickRow = k => { const i = rows[k]; if (i == null) return; sug.hidden = true; qi.setAttribute('aria-expanded', 'false'); hover = -1; gsel = -1; select(i, true); };
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
      setGraph: ng => setGraph(ng, true), pulseNow: () => { unschedule(); ambient(); }, fit: () => moveTo(fitTarget(), 380), focus: i => select(i, true), focusGroup, debug: dbg,
      get graph() { return g; }, get camera() { return Object.assign({}, cam); }, get layout() { return L; },
      screenOf: i => [sx(i), sy(i)],
      destroy() { alive = false; if (raf) cancelAnimationFrame(raf); raf = 0; unschedule(); if (pulseT) clearTimeout(pulseT); pulseT = 0; if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis); scene = null; if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); host.innerHTML = ''; cv.width = cv.height = 0; host.wsmap = null; }
    });
  }
  window.WSMAP = { mount, COL, stats, ui: { cardHTML, groupCardHTML, cardAct, searchRows, viewSwitch, names, neighOf, esc, fold } };
})();
