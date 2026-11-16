/* Front page: the flow trainer in miniature, over the real A320 overhead photo.
   1 Build: the flow is drawn step by step, PF and PM in their own colours. 3 Practise: the lines go, a question asks for the
   next PF step, and taps answer it (one miss on the way). Loops while it is on screen; a still picture with reduced motion.
   The steps only show how the trainer works; they are not an SOP. */
(function () {
  const ov = document.getElementById('fflOv'); if (!ov) return;
  const chip = document.getElementById('fflChip'), q = document.getElementById('fflQ'), NS = 'http://www.w3.org/2000/svg';
  const no = () => (document.documentElement.lang || '').slice(0, 2) === 'nb' || document.documentElement.lang === 'no';
  const T = (en, nb) => no() ? nb : en;
  const C = { PF: '#3CCB7F', PM: '#F2C230' };
  // [role, x, y] in the photo's 1000 × 597 frame
  const S = [['PM', 110, 173], ['PM', 145, 248], ['PM', 226, 362], ['PF', 474, 82], ['PF', 551, 178], ['PF', 493, 345], ['PF', 640, 420], ['PM', 860, 103], ['PM', 790, 350]];
  const num = S.map((s, i) => S.slice(0, i + 1).filter(x => x[0] === s[0]).length);
  const pf = S.map((s, i) => i).filter(i => S[i][0] === 'PF');
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (p || ov).appendChild(e); return e; };
  const d = (a, b) => { const mx = (a[1] + b[1]) / 2, my = (a[2] + b[2]) / 2, dx = b[1] - a[1], dy = b[2] - a[2]; return `M${a[1]} ${a[2]}Q${mx - dy * 0.18} ${my + dx * 0.18} ${b[1]} ${b[2]}`; };
  let lines = [], bds = [], timers = [], run = false, seen = false;
  const at = (ms, f) => timers.push(setTimeout(f, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  function build() { ov.innerHTML = ''; lines = []; bds = []; const k = ov.clientWidth && ov.clientWidth < 640 ? 1.9 : 1;
    el('rect', { x: 0, y: 0, width: 1000, height: 597, fill: '#000', opacity: '.12' });
    const gl = el('g', {}), gb = el('g', {});
    S.forEach((s, i) => { const prev = S.slice(0, i).reverse().find(x => x[0] === s[0]);
      if (prev) { const A = { d: d(prev, s), pathLength: 100, 'stroke-dasharray': '100 110', 'stroke-dashoffset': 101 }, p0 = el('path', Object.assign({ stroke: '#000', 'stroke-opacity': '.5', 'stroke-width': 8 * k }, A), gl), p = el('path', Object.assign({ stroke: C[s[0]], 'stroke-width': 4.5 * k }, A), gl); lines[i] = [p0, p]; }
      const g = el('g', { class: 'bd', transform: `translate(${s[1]} ${s[2]})` }, gb); g.style.opacity = 0; g.style.transform = `translate(${s[1]}px,${s[2]}px) scale(.2)`;
      el('circle', { r: 15 * k, fill: C[s[0]], stroke: '#0B0F12', 'stroke-width': 3 * k }, g); const t = el('text', { y: 5.5 * k, style: `font-size:${15 * k}px` }, g); t.textContent = num[i]; bds[i] = g; }); }
  const showB = (i, on, sc) => { const g = bds[i], s = S[i]; g.style.opacity = on ? 1 : 0; g.style.transform = `translate(${s[1]}px,${s[2]}px) scale(${on ? sc || 1 : .2})`; };
  const showL = (i, on) => { if (lines[i]) lines[i].forEach(p => { p.style.strokeDashoffset = on ? 0 : 101; }); };
  const ripple = (x, y, c) => { const k = ov.clientWidth < 640 ? 1.9 : 1, r = el('circle', { class: 'rp', cx: x, cy: y, r: 16 * k, stroke: c, 'stroke-width': 3 * k }); setTimeout(() => r.remove(), 1000); };
  const setChip = (n, en, nb) => { chip.innerHTML = `<i>${n}</i>${T(en, nb)}`; };
  const ask = (h) => { q.innerHTML = h; q.classList.toggle('on', !!h); };
  function still() { build(); S.forEach((s, i) => { showL(i, true); showB(i, true); }); setChip(1, 'Build', 'Bygg'); ask(''); }
  function loop() { if (!run) return; clear(); build(); ask(''); setChip(1, 'Build', 'Bygg'); let t = 400;
    S.forEach((s, i) => { at(t, () => showL(i, true)); at(t + 260, () => showB(i, true)); t += 620; });
    t += 1600;
    at(t, () => { setChip(3, 'Practise', 'Øv'); S.forEach((s, i) => { showL(i, false); showB(i, false); }); }); t += 700;
    pf.forEach((i, k) => { const s = S[i];
      at(t, () => ask(`<b>PF</b> · ${T('step', 'steg')} ${k + 1} / ${pf.length} · ${T('Where is the next step?', 'Hvor er neste steg?')}`)); t += 1100;
      if (k === 2) { at(t, () => ripple(s[1] - 150, s[2] + 40, '#FF4D4D')); t += 900; }
      at(t, () => { ripple(s[1], s[2], '#3CCB7F'); showB(i, true); if (k) showL(i, true); }); t += 900; });
    at(t, () => ask(`<b>${pf.length - 1} / ${pf.length}</b> ${T('right first time', 'riktig på første forsøk')}`)); t += 2600;
    at(t, loop); }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function start() { if (reduce.matches) { run = false; clear(); still(); return; } if (run) return; run = true; loop(); }
  function stop() { run = false; clear(); }
  still();
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { seen = true; start(); } else if (seen) stop(); }), { threshold: 0.35 }).observe(ov);
  else start();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
