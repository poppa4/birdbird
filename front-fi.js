/* NORDAP front page: the Flight Intelligence panel in the hero (#fpFi).
   Three example questions, answered the way fi.html answers: from the pilot's own documents (AFM, SOP) and from
   NORDAP's EASA rules library (easa.js: Easy Access Rules for Air Operations, Rev. 24), every statement with a
   citation chip and every source listed with its revision. The documents here are illustrative and say so.
   The answer is typed in at reading pace (the untyped rest is laid out but hidden, so nothing moves), the source rows
   light up as they are cited, and after a pause the next example follows. Paused off screen, in a hidden tab and while
   the pointer or focus is on the panel. Reduced motion: whole answers, no automatic change; the 1 2 3 buttons still work.
   Screen readers get each answer whole (the typed copy is aria-hidden). EN/NO through LAB. */
(function () {
  'use strict';
  const box = document.getElementById('fpFi'), stack = document.getElementById('fiStack'), pg = document.getElementById('fiPg');
  if (!box || !stack || !pg || window.__fpFi) return;
  const t2 = (en, no) => ({ en, no });
  const L = o => (typeof o === 'string' ? o : (window.LAB && LAB.lang === 'no') ? o.no : o.en);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the documents (illustrative) and the EASA library */
  const DOC = {
    afm: { k: 'AFM', n: t2('Aircraft Flight Manual, A320 (illustrative)', 'Flyhåndbok (AFM), A320 (illustrerende)'), r: t2('Rev. 12', 'Rev. 12') },
    sop: { k: 'SOP', n: t2('Operations Manual Part B, SOP (illustrative)', 'Driftshåndbok del B, SOP (illustrerende)'), r: t2('Issue 4', 'Utgave 4') },
    easa: { k: 'EASA', n: t2('Easy Access Rules for Air Operations', 'Easy Access Rules for Air Operations'), r: t2('Rev. 24 · Mar 2026', 'Rev. 24 · mars 2026') }
  };
  const E = id => ({ c: id, d: 'easa' });                       // EASA chip: rule ID (the chip adds "EASA")
  const D = (d, en, no) => ({ c: t2(en, no), d });              // document chip: section and page
  const QA = [
    { q: t2('The RVR drops below our minimum as we pass 1,400 ft on the ILS. Can we continue?',
            'RVR faller under minimum idet vi passerer 1 400 ft på ILS-en. Kan vi fortsette?'),
      a: [[t2('Yes, down to 1,000 ft above aerodrome elevation. If the reported RVR is still below your minimum there, you may not continue the approach.',
              'Ja, ned til 1 000 ft over flyplassens høyde. Er rapportert RVR fortsatt under minimum der, kan du ikke fortsette innflygingen.'), E('CAT.OP.MPA.305')],
          [t2('Had it dropped after you passed 1,000 ft, you could continue to DA/H, and go around there without the required visual reference.',
              'Hadde den falt etter at du passerte 1 000 ft, kunne du fortsatt til DA/H, og gått rundt der uten nødvendig visuell referanse.'), E('GM1 CAT.OP.MPA.305')],
          [t2('Your SOP adds a check at 1,000 ft: the PM reads out the latest RVR before the PF continues.',
              'SOP-en din legger inn en kontroll ved 1 000 ft: PM leser opp siste RVR før PF fortsetter.'), D('sop', 'SOP 6.4 · p. 6-12', 'SOP 6.4 · s. 6-12')]],
      src: ['easa', 'sop'] },
    { q: t2('Which planning minima apply to our destination alternate?',
            'Hvilke planleggingsminima gjelder for destinasjonsalternativet vårt?'),
      a: [[t2('It depends on the approach you plan to fly there. Type B, such as a CAT I ILS: ceiling DA/H + 200 ft and RVR/VIS + 800 m. Type A: DA/H or MDA/H + 400 ft and RVR/VIS + 1,500 m. Circling: MDA/H + 400 ft and VIS + 1,500 m.',
              'Det avhenger av innflygingen du planlegger å fly der. Type B, for eksempel en CAT I ILS: skybase DA/H + 200 ft og RVR/sikt + 800 m. Type A: DA/H eller MDA/H + 400 ft og RVR/sikt + 1 500 m. Sirkling: MDA/H + 400 ft og sikt + 1 500 m.'), E('AMC6 CAT.OP.MPA.182')],
          [t2('Check the forecast wind against the crosswind planning minima for the expected runway condition as well.',
              'Kontroller også vindprognosen mot sidevindsminima for planlegging ved forventet rullebanetilstand.'), E('AMC3 CAT.OP.MPA.182')],
          [t2('For a wet runway your SOP sets 20 kt.', 'For våt rullebane setter SOP-en din 20 kt.'), D('sop', 'SOP 2.3 · p. 2-9', 'SOP 2.3 · s. 2-9')]],
      src: ['easa', 'sop'] },
    { q: t2('How much final reserve fuel do we have to plan with?',
            'Hvor mye final reserve fuel må vi planlegge med?'),
      a: [[t2('Thirty minutes at holding speed at 1,500 ft above the destination alternate, for a turbine-engined aeroplane.',
              'Tretti minutter med holdefart i 1 500 ft over destinasjonsalternativet, for et turbinfly.'), E('CAT.OP.MPA.181')],
          [t2('At your planned landing mass of 58 t that is about 1,150 kg, from the holding fuel-flow table.',
              'Med planlagt landingsmasse på 58 t er det omtrent 1 150 kg, fra tabellen for drivstofforbruk i holding.'), D('afm', 'AFM 5.6 · p. 5-31', 'AFM 5.6 · s. 5-31')],
          [t2('Your SOP rounds it up to a fixed 1,200 kg on the flight plan.',
              'SOP-en din runder det opp til faste 1 200 kg på driftsfærdplanen.'), D('sop', 'SOP 3.5 · p. 3-14', 'SOP 3.5 · s. 3-14')]],
      src: ['easa', 'afm', 'sop'] }
  ];
  const CUR = '\u2060<i class="fi-cur"></i>\u2060';
  const CHIP = 10;   // a chip costs as much time as ten characters: a short beat before it lands

  const len = it => it.d ? CHIP : L(it).length;
  const total = qa => qa.a.reduce((n, p) => n + p.reduce((m, it) => m + len(it), 0), 0);
  const chip = it => `<span class="fi-c${it.d === 'easa' ? ' e' : ''}">${esc(L(it.c))}</span>`;

  /* the answer with the first n units shown, the rest laid out but hidden; returns the html and the documents cited so far */
  function answer(qa, n) {
    let left = n, out = '', ghost = false; const cited = new Set();
    for (const p of qa.a) {
      out += ghost ? '<p class="gh">' : '<p>';
      let open = false;
      for (const it of p) {
        if (ghost) { out += it.d ? chip(it) : esc(L(it)); continue; }
        const c = len(it);
        if (left >= c) { out += it.d ? chip(it) : esc(L(it)); left -= c; if (it.d) cited.add(it.d); continue; }
        // the caret goes here, and everything after it is hidden (CUR: word joiners keep the caret from opening a line break inside a word, so the lines never re-wrap while typing)
        if (!it.d && left > 0) { const s = L(it); out += esc(s.slice(0, left)) + CUR + '<span class="gh">' + esc(s.slice(left)); }
        else out += CUR + '<span class="gh">' + (it.d ? chip(it) : esc(L(it)));
        left = 0; ghost = true; open = true;
      }
      if (open) out += '</span>';
      out += '</p>';
    }
    return { html: out, cited };
  }
  const plain = qa => qa.a.map(p => p.map(it => it.d ? ` (${it.d === 'easa' ? 'EASA ' : ''}${L(it.c)})` : L(it)).join('')).join(' ');

  /* ---------- build ---------- */
  let cur = 0, n = 0, phase = 'type', hold = 0;
  const T = { lbl: t2('Example · illustrative documents', 'Eksempel · illustrerende dokumenter'), src: t2('Sources', 'Kilder'),
    ex: t2('Example', 'Eksempel'), of: t2('of', 'av') };
  function build() {
    stack.innerHTML = QA.map((qa, i) => `<div class="fi-qa" data-i="${i}" aria-hidden="${i !== cur}">
      <p class="fi-k">${esc(L(T.lbl))}</p>
      <p class="fi-q">${esc(L(qa.q))}</p>
      <p class="vh">${esc(plain(qa))}</p>
      <div class="fi-a" aria-hidden="true"></div>
      <div class="fi-src"><p class="fi-k">${esc(L(T.src))}</p><ol>${qa.src.map(k => `<li data-d="${k}"><b>${DOC[k].k}</b><span>${esc(L(DOC[k].n))}</span><span>${esc(L(DOC[k].r))}</span></li>`).join('')}</ol></div>
    </div>`).join('');
    pg.innerHTML = QA.map((qa, i) => `<li><button type="button" data-i="${i}" aria-pressed="${i === cur}" aria-label="${esc(L(T.ex))} ${i + 1} ${esc(L(T.of))} ${QA.length}">${i + 1}<i></i></button></li>`).join('');
    pg.hidden = false;
    measure();
  }
  /* Each paragraph keeps the height of its complete text. Splitting a word at the caret changes its width by a fraction of a
     pixel (no kerning across the split), which can re-wrap a line that only just fits; with the height fixed, nothing below moves. */
  let PH = [], PW = 0;
  function measure() {
    PH = []; PW = stack.clientWidth;
    QA.forEach((qa, i) => { paint(i, total(qa)); const el = stack.children[i]; PH[i] = el ? [...el.querySelectorAll('.fi-a>p')].map(p => p.offsetHeight) : []; });
    QA.forEach((qa, i) => paint(i, i === cur ? Math.floor(n) : total(qa)));
  }
  function paint(i, k) {
    const el = stack.children[i]; if (!el) return;
    const r = answer(QA[i], k);
    el.querySelector('.fi-a').innerHTML = r.html;
    if (PH[i]) el.querySelectorAll('.fi-a>p').forEach((p, j) => { if (PH[i][j]) p.style.height = PH[i][j] + 'px'; });
    for (const li of el.querySelectorAll('.fi-src li')) li.classList.toggle('on', r.cited.has(li.dataset.d));
  }
  function show(i, typed) {
    const prev = cur; cur = i; n = typed ? 0 : total(QA[i]); phase = typed ? 'type' : 'hold'; hold = 0;
    for (const el of stack.children) el.setAttribute('aria-hidden', String(+el.dataset.i !== i));
    for (const b of pg.querySelectorAll('button')) { b.setAttribute('aria-pressed', String(+b.dataset.i === i)); b.querySelector('i').style.transform = 'scaleX(0)'; }
    if (prev !== i) paint(prev, total(QA[prev]));
    paint(i, n);
  }

  /* ---------- clock ---------- */
  const CPS = 52, HOLD = 9;   // characters per second; seconds an answer stays once complete
  let vis = false, over = false, raf = 0, last = 0;
  function frame(ts) {
    raf = 0; if (!vis || over || document.hidden || RM) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    if (phase === 'type') {
      const N = total(QA[cur]), k = Math.min(N, n + dt * CPS);
      if (Math.floor(k) !== Math.floor(n)) { n = k; paint(cur, Math.floor(n)); } else n = k;
      if (n >= N) { phase = 'hold'; hold = 0; paint(cur, N); }
    } else {
      hold += dt;
      const b = pg.querySelector(`button[data-i="${cur}"] i`); if (b) b.style.transform = `scaleX(${Math.min(1, hold / HOLD).toFixed(3)})`;
      if (hold >= HOLD) show((cur + 1) % QA.length, true);
    }
  }
  function go() { if (!raf && vis && !over && !document.hidden && !RM) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  pg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; show(+b.dataset.i, false); });
  box.addEventListener('pointerenter', () => { over = true; });
  box.addEventListener('pointerleave', () => { over = false; go(); });
  box.addEventListener('focusin', () => { over = true; });
  box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) { over = false; go(); } });
  document.addEventListener('visibilitychange', go);
  if (window.LAB && LAB.onLang) LAB.onLang(() => { n = phase === 'type' ? Math.min(n, total(QA[cur])) : total(QA[cur]); build();
    if (live) { for (const el of stack.children) el.setAttribute('aria-hidden', 'true'); stack.appendChild(live); pg.hidden = true; } });

  if (RM) n = total(QA[0]);
  build();
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (stack.clientWidth !== PW) measure(); }).observe(stack);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; go(); }, { threshold: 0.2 }).observe(box);
  else { vis = true; go(); }

  /* ---------- ask for real: the visitor's own question, answered here ----------
     The same service as fi.html (ai.js → /api/atc), grounded in NORDAP's EASA rules library (easa.js). ai.js and easa.js load
     on first focus. The examples stop for good once a question is asked; the thread stays in this page only. Rules
     questions cite [E1]…; anything not in the library is marked as general knowledge. The pilot's own documents live on the
     Flight Intelligence page, so every answer offers to continue there. */
  const form = document.getElementById('fiAskF'), inp = document.getElementById('fiAskIn');
  let live = null, turns = [], busy = false, loading = null;
  const LT = { ph: t2('Ask Flight Intelligence', 'Spør Flight Intelligence'), wait: t2('Thinking…', 'Tenker …'),
    cont: t2('Continue in Flight Intelligence →', 'Fortsett i Flight Intelligence →'),
    docs: t2('Answer from my own AFM and SOP →', 'Svar fra min egen AFM og SOP →'),
    clear: t2('Back to the examples', 'Tilbake til eksemplene'),
    easy: t2('Explain it more simply', 'Forklar enklere'), easier: t2('Even simpler', 'Enda enklere'),
    off: t2('Flight Intelligence is not available right now. You can still open it and use the EASA rules library.', 'Flight Intelligence er ikke tilgjengelig akkurat nå. Du kan fortsatt åpne den og bruke EASA-regelbiblioteket.'),
    gk: t2('general knowledge', 'generell kunnskap') };
  const setPh = () => { if (inp) inp.placeholder = L(LT.ph); };
  const load = src => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
  function deps() { if (!loading) loading = Promise.all([window.NAI ? 0 : load('ai.js?v=8'), window.EASA ? 0 : load('easa.js?v=4')]).catch(() => {}); return loading; }

  function md(text, list) {
    let h = esc(String(text || '').trim());
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    const out = []; let ul = null;
    for (const line of h.split('\n')) {
      const m = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!ul) { ul = []; } ul.push(`<li>${m[1]}</li>`); continue; }
      if (ul) { out.push(`<ul>${ul.join('')}</ul>`); ul = null; }
      if (line.trim()) out.push(`<p>${line}</p>`);
    }
    if (ul) out.push(`<ul>${ul.join('')}</ul>`);
    h = out.join('');
    h = h.replace(/\[GK\]/g, `<span class="gk">${esc(L(LT.gk))}</span>`).replace(/\[S\d+\]/g, '');
    return window.EASA ? EASA.cite(h, list) : h;
  }
  function fiUrl(q) { return 'fi.html?q=' + encodeURIComponent(String(q).slice(0, 1500)); }
  function paintLive() {
    if (!live) return;
    live.innerHTML = turns.map((t, i) => `<div class="fi-t">
      <p class="fi-q">${esc(t.q)}</p>
      <div class="fi-a">${t.err ? `<p class="fi-err">${esc(t.err)}</p>` : t.a == null ? `<p class="fi-wait">${esc(L(LT.wait))}</p>` : md(t.a, t.list)}</div>
      ${i === turns.length - 1 && t.a != null ? `<div class="fi-go"><button type="button" class="fi-easy" data-fi-easy>${esc(L(t.easy ? LT.easier : LT.easy))}</button><a href="${fiUrl(t.src || t.q)}">${esc(L(LT.cont))}</a><a href="fi.html#docs">${esc(L(LT.docs))}</a><button type="button" data-fi-clear>${esc(L(LT.clear))}</button></div>` : ''}
    </div>`).join('');
    live.scrollTop = live.scrollHeight;
  }
  function startLive() {
    if (live) return;
    over = true; if (raf) { cancelAnimationFrame(raf); raf = 0; }
    for (const el of stack.children) el.setAttribute('aria-hidden', 'true');
    pg.hidden = true;
    stack.classList.add('is-live');
    live = document.createElement('div'); live.className = 'fi-live'; live.setAttribute('aria-live', 'polite');
    stack.appendChild(live);
    live.addEventListener('click', e => { if (e.target.closest('[data-fi-clear]')) stopLive(); else if (e.target.closest('[data-fi-easy]')) ask('', true); });
  }
  function stopLive() {
    if (!live) return; live.remove(); live = null; stack.classList.remove('is-live'); turns = []; pg.hidden = false; over = false; show(cur, false); go();
  }
  /* "Explain it more simply": the last answer again in plain language, same facts and EASA entries, nothing new */
  const EASY = 'The pilot finds your last answer hard to follow. Explain the same thing again in plain language: start with the core idea in one or two short sentences; use short sentences and everyday words; explain every abbreviation the first time you use it (for example RVR = how far you can see along the runway); give one concrete example with real numbers, or one simple comparison; end with one line on what it means in practice for the pilot. Keep exactly the same facts, numbers, rule IDs and citations as your last answer. Do not add new rules, numbers or exceptions, and do not leave out a condition that changes the answer.';
  function prompt(q, list, easy) {
    const hist = turns.slice(-5, -1).filter(t => t.a).map(t => 'PILOT: ' + t.q.slice(0, 800) + '\nFLIGHT INTELLIGENCE: ' + t.a.slice(0, 1200)).join('\n');
    return `You are Flight Intelligence, the AI instructor of NORDAP (the Nordic Aviation Platform), answering a pilot on NORDAP's front page. Answer any aviation question clearly, like a good flight instructor: aerodynamics, meteorology, systems, navigation, procedures and EASA rules.
Write in ${NAI.langName()} and keep aviation terms in English. Be concrete and short: at most a few short paragraphs or a short list. No tables.
${list.length ? EASA.promptBlock(list) : 'EASA RULES: no entry from the NORDAP EASA rules library matched this question. Do not state any rule ID, minimum, fuel figure or other regulatory number from memory: say that it is not in the NORDAP rules library yet and that the pilot should check the current EASA Easy Access Rules.'}

RULES FOR THIS ANSWER: Mark every statement that does not come from an EASA entry above with [GK] (general knowledge), once at the end of the sentence. Never give aircraft-specific limitations, speeds or procedure steps from memory: say that Flight Intelligence can answer that from the pilot's own AFM and SOP on the Flight Intelligence page. If the question contains a wrong premise (a wrong number, a rule that does not exist), correct it. Calculations the pilot asks for (descent, wind, fuel, time, conversions and so on) are allowed and wanted: use the calculator markers described in your instructions; a calculated result is not [GK].
${hist ? '\nCONVERSATION SO FAR:\n' + hist + '\n' : ''}
${easy ? 'PILOT NOW: (asks you to explain your last answer more simply)\n' + EASY : 'PILOT: ' + q.slice(0, 1500)}`;
  }
  async function ask(q, easy) {
    q = String(q || '').trim(); const prev = easy ? [...turns].reverse().find(x => x.a) : null;
    if (busy || (easy ? !prev : !q)) return;
    busy = true; const btn = form.querySelector('button'); if (btn) btn.disabled = true;
    startLive();
    const t = easy ? { q: L(LT.easy), a: null, list: prev.list, easy: true, src: prev.src || prev.q } : { q, a: null, list: [] };
    turns.push(t); if (turns.length > 8) turns.shift(); paintLive();
    try {
      await deps();
      if (!window.NAI || !(await NAI.ready)) { t.err = L(LT.off); }
      else {
        if (!easy) t.list = EASA.isRules(q) ? EASA.search(q, 4) : [];
        t.a = String(await NAI.text(prompt(q, t.list, easy), { tier: 'default' }) || '').split(/\n-{3,}\s*\n?/)[0];
        if (!t.a.trim()) t.err = NAI.errText({ code: 'other' });
      }
    } catch (e) { t.err = window.NAI ? NAI.errText(e) : L(LT.off); }
    busy = false; if (btn) btn.disabled = false; paintLive();
  }
  if (form && inp) {
    setPh();
    inp.addEventListener('focus', deps, { once: true });
    form.addEventListener('submit', e => { e.preventDefault(); const q = inp.value; inp.value = ''; ask(q); });
    if (window.LAB && LAB.onLang) LAB.onLang(() => { setPh(); paintLive(); });
  }

  window.__fpFi = { show, get state() { return { cur, n, phase }; } };
})();
