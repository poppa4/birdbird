/* Birdbird front page: the storm lab's build-up, played like a short film, with the lab's stage panel beside it.
   This is the real scene from storms.html: cbmodel.js (the single-cell life cycle) drawn by cb3d.js (three.js r128),
   loaded only when the section comes near the screen. The timeline runs 0–60 min of storm time in about 36 s, the camera
   drifts slowly round the cell, and the panel follows the stage of the main cell (cbmodel's own c.dev). Clicking a stage
   jumps there. Paused off screen. With reduced motion, Save-Data or no WebGL the poster (a 2× render of this same scene)
   stays, and the panel shows the mature stage. Every string EN/NO. */
(function () {
  'use strict';
  const box = document.getElementById('fpStorm'); if (!box || window.__fpStorm) return;
  window.__fpStorm = 1;
  const { L, el, nf } = LAB, t2 = (en, no) => ({ en, no });
  const view = el('fsView'), cv = el('fsCv'), lab = el('fsLbl'), list = el('fsStages'), ro = el('fsRo'), bar = el('fsBar'), clock = el('fsClock'), btn = el('fsPlay'), togs = el('fsTogs'), card = el('fsCard');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, SD = navigator.connection && navigator.connection.saveData;

  /* the five named stages of a single cell (the same stages and start times as storms.js) */
  const DEV = {
    hum: { ab: 'CU', n: t2('Cumulus', 'Cumulus'), t: 3,
      w: t2('Small heaps with flat bases, tops below the freezing level. Rising thermals, nothing more.', 'Små hauger med flat base, toppene under frysenivået. Stigende termikk, ikke noe mer.') },
    tcu: { ab: 'TCU', n: t2('Towering cumulus', 'Tårnende cumulus'), t: 10,
      w: t2('Tall cauliflower towers. Strong updrafts carry supercooled water above the freezing level: severe turbulence and icing inside.', 'Høye blomkålstårn. Sterk oppvind bærer underkjølt vann over frysenivået: kraftig turbulens og ising inni.') },
    calvus: { ab: 'CB', n: t2('Cumulonimbus calvus', 'Cumulonimbus calvus'), t: 17,
      w: t2('The top turns to ice and the edges go soft. The first lightning; rain forms aloft but has not reached the ground.', 'Toppen blir til is og kantene blir myke. De første lynene; regn dannes i høyden, men har ikke nådd bakken.') },
    incus: { ab: 'CB', n: t2('Mature CB with anvil', 'Moden CB med ambolt'), t: 26,
      w: t2('The anvil spreads downwind, rain and hail reach the ground, the downdraft spreads out as a gust front. Avoid by 20 NM.', 'Ambolten sprer seg med vinden, regn og hagl når bakken, nedvinden sprer seg som en vindkastfront. Unngå med 20 NM.') },
    dis: { ab: 'CB', n: t2('Dissipating', 'I oppløsning'), t: 47,
      w: t2('Downdrafts only: the updraft is cut off and the storm rains itself out. The anvil drifts on.', 'Bare nedvind: oppvinden er kuttet, og stormen regner seg ut. Ambolten driver videre.') }
  };
  const DEVK = ['hum', 'tcu', 'calvus', 'incus', 'dis'];
  const START = { hum: 0, tcu: 6, calvus: 14, incus: 20, dis: 35 };   // cbmodel: stage boundaries for a single cell, low shear
  const LAYERS = [['flow', t2('Air motion', 'Luftbevegelse')], ['gust', t2('Gust front', 'Vindkastfront')], ['ltg', t2('Lightning', 'Lyn')], ['avoid', t2('Avoid 10 / 20 NM', 'Unngå 10 / 20 NM')]];
  const COND = { cape: 'mod', td: 16, shear: 'low', fzl: 10000, uw: 50, type: 'single', t: 26 };
  const show = { flow: false, hail: false, gust: false, ring: false, ltg: true, ice: false, turb: false, avoid: true, levels: false, labels: true, cloud: 'solid', truth: false };
  const E = {}, CELLS = [], TEND = 60, RATE = 60 / 36;   // storm minutes per second of film
  let cur = 'incus', V = null, live = false, play = !RM, vis = false, last = 0, acc = 0, tNow = 0, hold = 0;
  const M = () => window.CBM, TH0 = 1.75, PH0 = 1.52;   // camera: the lab's 3/4 view swung round so the anvil streams across the frame
  const fl = v => v >= 10000 ? 'FL' + Math.round(v / 100) : nf(v, 0) + ' ft';

  /* ---------- panel ---------- */
  function drawList() {
    list.innerHTML = DEVK.map(k => { const d = DEV[k];
      return `<li><button type="button" data-s="${k}" class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}"><i>${d.ab}</i><b>${L(d.n)}</b><span>${nf(START[k], 0)} min</span></button></li>`; }).join('');
    togs.innerHTML = LAYERS.map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${!!show[k]}" class="${show[k] ? 'on' : ''}">${L(t)}</button>`).join('');
    btn.textContent = play ? L(t2('Pause', 'Pause')) : L(t2('Play', 'Spill av'));
    btn.setAttribute('aria-pressed', String(play)); btn.hidden = !live;
    togs.closest('.fs-lay').hidden = !live;
  }
  function readout() {
    const c = M() && M().main(CELLS), d = DEV[cur];
    card.innerHTML = `<b>${d.ab} · ${L(d.n)}</b>${L(d.w)}`;
    if (!c) { ro.innerHTML = `<div><dt>T+</dt><dd>26 min</dd></div><div><dt>${L(t2('TOP', 'TOPP'))}</dt><dd>FL385</dd></div>`; return; }
    const top = (Math.min(c.top, M().TROPO) + (c.over || 0));
    ro.innerHTML = `<div><dt>T+</dt><dd>${String(Math.floor(COND.t)).padStart(2, '0')} min</dd></div><div><dt>${L(t2('TOP', 'TOPP'))}</dt><dd>${fl(Math.round(top / 500) * 500)}</dd></div><div><dt>${L(t2('UPDRAFT', 'OPPVIND'))}</dt><dd>${c.up ? '≈' + nf(Math.round(c.up / 100) * 100, 0) + ' ft/min' : '–'}</dd></div>`;
    clock.textContent = `${nf(Math.floor(COND.t), 0)} / ${TEND} min`;
    bar.style.transform = `scaleX(${(COND.t / TEND).toFixed(4)})`;
  }
  function setStage(k, redraw) { if (k === cur && !redraw) return; cur = k; for (const b of list.querySelectorAll('button')) { const on = b.dataset.s === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } readout(); if (V) V.relabel(); }
  function model() { M().storm(COND, E, CELLS); const c = M().main(CELLS); const k = c && c.dev in DEV ? c.dev : (COND.t >= START.dis ? 'dis' : 'hum'); if (k !== cur) setStage(k); else readout(); if (V) V.setStorm(E, CELLS, COND); }

  /* only the main cell's name: the panel carries the rest, so the picture stays clean */
  function labels(lbl, api, narrow) {
    if (api.view !== 'storm') return; const m = M(), c = m.main(CELLS); if (!c || !(c.dev in DEV)) return;
    const FT = m.FT2KM, vx = api.VEX.storm || 1, hb = E.base * FT, top = Math.min(c.top, m.TROPO);
    lbl(DEV[c.dev].ab + ' · ' + L(DEV[c.dev].n), c.x + E.tilt * (top * FT - hb), (top + (c.over || 0)) * FT * vx, c.z, 'up', narrow ? 0 : -90, -38, 4);
    if (show.avoid && c.st !== 'cu') { lbl('10 NM', c.x - 18.5, 0.2, c.z, 'av', 0, -18, 2); lbl('20 NM', c.x - 37, 0.2, c.z, 'av', 0, -18, 2); }
    if (show.gust && c.gust > 2) { m.downCentre(E, c, DCe); lbl(L(t2('Gust front', 'Vindkastfront')), DCe.x + c.gust, 0.9 * vx, DCe.z, 'dn', 30, -34, 3); }
  }
  const DCe = { x: 0, z: 0 };

  list.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.s;
    if (!live) { location.href = 'storms.html#explore'; return; }
    COND.t = DEV[k].t; hold = 0; model(); });
  togs.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !V) return; const k = b.dataset.k; show[k] = !show[k]; V.setShow(show); drawList(); V.relabel(); });
  btn.addEventListener('click', () => { play = !play; drawList(); });

  /* ---------- live scene ---------- */
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  function gl() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  async function start() {
    try {
      if (!window.THREE) await load('three.min.js');
      if (!window.CBM) await load('cbmodel.js?v=1');
      if (!window.CB3D) await load('cb3d.js?v=3');
    } catch (e) { return; }
    model();
    V = CB3D.init({ host: view, canvas: cv, labels: lab, T: () => '', labelSet: labels });
    if (!V || !V.ok) { const n = view.querySelector('.nogl'); if (n) n.remove(); return; }
    V.setView('storm'); V.setLook('sky'); V.setShow(show); V.setStorm(E, CELLS, COND);
    V.zoom = 0.84; V.aim(TH0, PH0, true);
    V.resize(); live = true;
    window.__fpStorm = { get V() { return V; }, COND, model, pause() { play = false; drawList(); } }; drawList(); readout();
    requestAnimationFrame(() => { V.tick(0.016, 0, false); requestAnimationFrame(() => { view.classList.add('live'); }); });
    requestAnimationFrame(loop);
  }
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, ((ts || 0) - last) / 1000) || 0.016; last = ts || 0;
    if (!vis || document.hidden) return;
    const anim = !RM; if (anim) tNow += dt;
    if (play) {
      if (COND.t >= TEND - 2) { hold += dt; if (hold > 1.2) { view.classList.add('cut'); if (hold > 1.6) { COND.t = 0; hold = 0; model(); view.classList.remove('cut'); } } }
      else { COND.t = Math.min(TEND - 2, COND.t + dt * RATE); acc += dt; if (acc > 0.1) { acc = 0; model(); } }
    }
    if (anim) V.aim(TH0 + 0.3 * Math.sin(tNow * 0.07), PH0 - 0.03 * Math.sin(tNow * 0.05));
    V.tick(dt, tNow, anim);
  }

  /* ---------- wiring ---------- */
  drawList(); setStage(cur, true);
  LAB.onLang(() => { drawList(); readout(); if (V) V.relabel(); });
  const canLive = !RM && !SD && 'IntersectionObserver' in window && gl();
  if (!('IntersectionObserver' in window)) return;
  let kicked = false;
  new IntersectionObserver(es => { for (const e of es) { vis = e.isIntersecting;
    if (vis && !kicked && canLive) { kicked = true; (window.requestIdleCallback || (f => setTimeout(f, 150)))(start, { timeout: 1500 }); } } }, { rootMargin: '300px 0px' }).observe(box);
})();
