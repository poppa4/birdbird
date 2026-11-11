/* Birdbird – My Workspace: "Ask your documents" as a desk tab (Flight Intelligence beside the manual).
   The same contract as fi.html: the passages are found here in the browser (in the document text already stored
   for Flight Intelligence), only the question and those passages go to the AI through ai.js (window.NAI: the
   /api/atc service, or Claude when the page runs inside Claude). Nothing is stored on the server by this tab.
   When the AI is not available (no service, no key, signed out), the tab says so calmly and still finds the pages. */
(function () {
  'use strict';
  let X = null;
  const t = (en, no) => X.t(en, no), esc = s => X.esc(s);
  const MAX_Q = 1500, MAX_TURNS = 24;
  const chats = new Map();                   // tab ref -> { turns:[{ q, a, src, err }] } (this session only)
  let lastDoc = null, wantDoc = false;       // the document "Ask" was opened from
  const liveViews = new Set();

  /* ---------- finding passages (the same scoring as Flight Intelligence) ---------- */
  const STOP = new Set('the and for are with that this from have has not you your was were will can into when what which who how its their there then than them they shall should must may also any all per under over more less such each other only been being would could does done between after before during og som det er til av med for på har ikke den kan skal'.split(' '));
  const tok = s => String(s).toLowerCase().replace(/[^a-z0-9æøå.%\- ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const SYN = [['alternator', 'generator', 'charging'], ['engine', 'motor', 'powerplant'], ['fuel', 'tank', 'crossfeed'], ['gear', 'undercarriage', 'landing gear'], ['ice', 'icing', 'de-ice', 'anti-ice', 'deicing'], ['stall', 'stalling'], ['vmca', 'minimum control speed'], ['vyse', 'blue line'], ['go-around', 'missed approach', 'goaround'], ['limitation', 'limit', 'maximum']];
  const expand = q => { const s = String(q).toLowerCase(), add = []; SYN.forEach(g => { if (g.some(w => s.includes(w))) add.push(...g); }); return s + ' ' + add.join(' '); };
  function search(q, k, docs) {
    const qt = [...new Set(tok(expand(q)))]; if (!qt.length) return [];
    const all = []; docs.forEach(d => (d.chunks || []).forEach(c => all.push({ d, c })));
    const N = all.length || 1, df = {}; qt.forEach(w => { df[w] = 0; });
    all.forEach(x => { const s = x.lc || (x.lc = x.c.t.toLowerCase()); qt.forEach(w => { if (s.includes(w)) df[w]++; }); });
    all.forEach(x => { let s = 0; qt.forEach(w => { if (!df[w]) return; let n = 0, i = -1; while ((i = x.lc.indexOf(w, i + 1)) >= 0 && n < 8) n++; if (n) s += Math.log(1 + N / df[w]) * (n / (n + 1.2)); }); if (x.d.kind === 'qrh' || x.d.kind === 'lim') s *= 1.08; x.s = s; });
    const out = all.filter(x => x.s > 0).sort((a, b) => b.s - a.s), seen = new Set(), pick = [];
    for (const x of out) { const key = x.d.id + ':' + x.c.p; if (seen.has(key) && pick.length > 2) continue; seen.add(key); pick.push(x); if (pick.length >= k) break; }
    return pick;
  }

  /* ---------- the answer: a little markdown, [S1] becomes a page chip ---------- */
  const shortName = n => { n = String(n || '').replace(/\s+/g, ' ').trim(); if (n.length <= 22) return n; const c = n.slice(0, 21); const sp = c.lastIndexOf(' '); return (sp > 10 ? c.slice(0, sp) : c).replace(/[\s,.;:–-]+$/, '') + '…'; };
  function chip(src, i) { const x = src[i - 1]; if (!x) return `<span class="ask-x" title="${esc(t('Not one of the passages: check it yourself', 'Ikke en av utdragene: sjekk det selv'))}">S${i}?</span>`; return `<button type="button" class="ask-src" data-doc="${esc(x.d.id)}" data-p="${x.c.p}" title="${esc(x.d.name + ' · ' + t('page ', 'side ') + x.label)}">${esc(shortName(x.d.name))} ${esc(t('p. ', 's. '))}${esc(x.label)}</button>`; }
  function md(s, src) {
    s = esc(s);
    const inl = x => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[S(\d{1,2})\]/g, (m, n) => chip(src, +n)).replace(/\[GK\]/g, `<span class="ask-gk" title="${esc(t('General knowledge, not from your documents', 'Generell kunnskap, ikke fra dokumentene dine'))}">GK</span>`);
    let h = '', list = null;
    s.split('\n').forEach(l => {
      const b = /^\s*[-*•]\s+(.*)$/.exec(l), n = /^\s*\d+[.)]\s+(.*)$/.exec(l);
      if (b || n) { const k = b ? 'ul' : 'ol'; if (list !== k) { if (list) h += `</${list}>`; h += `<${k}>`; list = k; } h += `<li>${inl((b || n)[1])}</li>`; return; }
      if (list) { h += `</${list}>`; list = null; }
      if (/^#{1,4}\s/.test(l)) h += `<p><b>${inl(l.replace(/^#+\s*/, ''))}</b></p>`; else if (l.trim()) h += `<p>${inl(l)}</p>`;
    });
    if (list) h += `</${list}>`;
    return h;
  }
  const plain = (s, src) => String(s || '').replace(/\[S(\d{1,2})\]/g, (m, n) => { const x = src[+n - 1]; return x ? '(' + shortName(x.d.name) + ' ' + t('p. ', 's. ') + x.label + ')' : ''; }).replace(/\[GK\]/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/[ \t]+\n/g, '\n').trim();

  /* ---------- the tab ---------- */
  function mountAsk(box, tab, ctx) {
    const A = X.A, W = A.W, S = A.S;
    const chat = chats.get(tab.r) || { turns: [] }; chats.set(tab.r, chat);
    let alive = true, busy = null, avail = null;
    const M = A.M; M.ask = M.ask || {};
    let scope = M.ask.scope || 'all', acId = M.ask.ac || ((A.aircraft().find(a => a.isDefault) || A.aircraft()[0] || {}).id || '');
    if (wantDoc) { scope = 'doc'; wantDoc = false; }
    const root = X.h('div', 'ask'); box.appendChild(root);
    root.innerHTML = `<div class="ask-bar"></div><div class="ask-sc" data-keep-scroll><div class="ask-in"><div class="ask-log" aria-live="polite"></div></div></div>
      <form class="ask-f" novalidate><label class="sr" for="askQ${esc(tab.id)}">${esc(t('Your question', 'Spørsmålet ditt'))}</label><textarea id="askQ${esc(tab.id)}" rows="2" maxlength="${MAX_Q}" enterkeyhint="send" placeholder="${esc(t('Ask about your documents, e.g. “maximum crosswind”', 'Spør om dokumentene dine, f.eks. «maks sidevind»'))}"></textarea><button type="submit" class="btn pri sm">${esc(t('Ask', 'Spør'))}</button><button type="button" class="btn sm" data-a="stop" hidden>${esc(t('Stop', 'Stopp'))}</button></form>`;
    const bar = root.querySelector('.ask-bar'), log = root.querySelector('.ask-log'), sc = root.querySelector('.ask-sc'), form = root.querySelector('.ask-f'), q = form.querySelector('textarea');

    /* which document is "the open document": the one showing in another pane, else the one Ask was opened from */
    function openDoc() { const d = X.docBeside(ctx.paneId) || lastDoc; return d && W.isLive(A.item(d)) && S.docs[d] ? d : null; }
    function docsInScope() {
      const all = A.docsAll().filter(d => S.docs[d.id] && (S.docs[d.id].chunks || []).length);
      if (scope === 'doc') { const d = openDoc(); return all.filter(x => x.id === d); }
      if (scope === 'ac') return all.filter(x => (x.acIds || []).includes(acId));
      return all;
    }
    function drawBar() {
      const acs = A.aircraft(), od = openDoc();
      if (scope === 'ac' && !acs.length) scope = 'all';
      bar.innerHTML = `<div class="seg ask-scope" role="group" aria-label="${esc(t('Ask', 'Spør'))}">
          ${acs.length ? `<button type="button" data-s="ac" class="${scope === 'ac' ? 'on' : ''}" aria-pressed="${scope === 'ac'}">${esc(t('This aircraft', 'Dette flyet'))}</button>` : ''}
          <button type="button" data-s="all" class="${scope === 'all' ? 'on' : ''}" aria-pressed="${scope === 'all'}">${esc(t('All my documents', 'Alle dokumentene mine'))}</button>
          <button type="button" data-s="doc" class="${scope === 'doc' ? 'on' : ''}" aria-pressed="${scope === 'doc'}"${od ? '' : ' disabled'} title="${esc(od ? A.item(od).name : t('Open a document beside this tab first', 'Åpne et dokument ved siden av denne fanen først'))}">${esc(t('The open document', 'Det åpne dokumentet'))}</button></div>
        ${scope === 'ac' && acs.length > 1 ? `<select class="ask-ac" aria-label="${esc(t('Aircraft', 'Fly'))}">${acs.map(a => `<option value="${esc(a.id)}"${a.id === acId ? ' selected' : ''}>${esc(a.reg || A.acName(a))}</option>`).join('')}</select>` : ''}
        <span class="ask-n">${esc(scopeLine())}</span><span class="sp"></span>
        ${chat.turns.length ? `<button type="button" class="dk-ib" data-a="clear" title="${esc(t('Clear this conversation', 'Tøm denne samtalen'))}" aria-label="${esc(t('Clear this conversation', 'Tøm denne samtalen'))}">${X.ic('x')}</button>` : ''}`;
    }
    function scopeLine() {
      const n = docsInScope().length;
      if (scope === 'doc') { const d = openDoc(); return d ? A.item(d).name : t('No document open beside', 'Ingen dokument åpent ved siden av'); }
      if (scope === 'ac') { const a = A.item(acId); return (a ? (a.reg || A.acName(a)) + ' · ' : '') + A.plural(n, 'document', 'documents', 'dokument', 'dokumenter'); }
      return A.plural(n, 'document', 'documents', 'dokument', 'dokumenter');
    }
    function intro() {
      const docs = A.docsAll().filter(d => S.docs[d.id]);
      if (avail === false) return `<div class="ask-off"><p class="eb">Flight Intelligence</p><h3>${esc(t('Answers from your documents are not switched on here yet.', 'Svar fra dokumentene dine er ikke slått på her ennå.'))}</h3>
        <p>${esc(t('When they are, you ask in your own words and get a short answer with the page it came from, for example “AFM p. 4-12”, and the page opens beside you. Nothing you type here has been sent anywhere.', 'Når de er det, spør du med dine egne ord og får et kort svar med siden det kom fra, for eksempel «AFM s. 4-12», og siden åpnes ved siden av deg. Ingenting du skriver her, er sendt noe sted.'))}</p>
        <p>${esc(t('Until then, a question still finds the pages that match it in your documents.', 'Inntil da finner et spørsmål likevel sidene i dokumentene dine som passer.'))}</p></div>`;
      if (!docs.length) return `<div class="ask-off"><p class="eb">Flight Intelligence</p><h3>${esc(t('Add a document to ask about it.', 'Legg til et dokument for å spørre om det.'))}</h3><p>${esc(t('Answers come only from your own AFM, QRH, SOP and checklists, with the page they came from. The files stay on this device.', 'Svarene kommer bare fra din egen AFM, QRH, SOP og sjekklister, med siden de kom fra. Filene blir på denne enheten.'))}</p><p><button type="button" class="btn sm" data-a="add">${esc(t('Add documents', 'Legg til dokumenter'))}</button></p></div>`;
      return `<div class="ask-hi"><p class="eb">Flight Intelligence</p><h3>${esc(t('Ask your documents', 'Spør dokumentene'))}</h3><p>${esc(t('Short answers from your own manuals, each with the page it came from. Tap a page to open it beside you, or copy the answer into your note.', 'Korte svar fra dine egne manualer, hvert med siden det kom fra. Trykk på en side for å åpne den ved siden av deg, eller kopier svaret inn i notatet ditt.'))}</p><p class="small">${esc(t('For learning. The approved flight manual always applies.', 'For opplæring. Den godkjente flyhåndboken gjelder alltid.'))}</p></div>`;
    }
    function drawLog() {
      const html = chat.turns.map((x, i) => `<div class="ask-q"><span>${esc(x.q)}</span></div>
        <div class="ask-a${x.err ? ' err' : ''}" data-i="${i}">${x.pending && !x.a ? `<p class="ask-wait">${esc(t('Reading your documents…', 'Leser dokumentene dine …'))}</p>` : x.local ? localHtml(x) : x.err ? `<p>${esc(x.err)}</p>` : md(x.a, x.src)}
        ${!x.pending && !x.err && !x.local && x.a ? `<div class="ask-acts">${usedHtml(x)}<span class="sp"></span><button type="button" class="btn sm" data-a="note" data-i="${i}">${X.ic('cite')}<span>${esc(t('Copy to note', 'Kopier til notat'))}</span></button><button type="button" class="dk-ib" data-a="copy" data-i="${i}" title="${esc(t('Copy', 'Kopier'))}" aria-label="${esc(t('Copy', 'Kopier'))}">${X.ic('tabs')}</button></div>` : ''}</div>`).join('');
      log.innerHTML = intro() + html;
    }
    function usedHtml(x) { const used = [...new Set((x.a.match(/\[S(\d{1,2})\]/g) || []).map(m => +m.slice(2, -1)))].filter(n => x.src[n - 1]); return used.length ? `<span class="ask-used">${used.map(n => chip(x.src, n)).join('')}</span>` : ''; }
    function localHtml(x) { return x.src.length ? `<p>${esc(t('These pages match your question:', 'Disse sidene passer med spørsmålet ditt:'))}</p><ul class="ask-hits">${x.src.map((s, i) => `<li>${chip(x.src, i + 1)}<span>${esc(A.W.snippet(s.c.t, A.W.tokens(x.q), 150))}</span></li>`).join('')}</ul>` : `<p>${esc(t('No page matches those words. Try other or fewer words.', 'Ingen side passer med de ordene. Prøv andre eller færre ord.'))}</p>`; }
    async function check() {
      if (avail !== null) return avail;
      try { if (!window.NAI) await A.loadScript('ai.js?v=1'); const m = await Promise.race([window.NAI.ready, new Promise(r => setTimeout(() => r(null), 6000))]); avail = !!m; }
      catch (e) { avail = false; }
      if (alive) { drawLog(); }
      return avail;
    }
    function prompt(question, src, hist) {
      const ex = src.length ? src.map((x, i) => `[S${i + 1}] ${x.d.name}${x.d.rev ? ', revision ' + x.d.rev : ''}, page ${x.label}${x.c.s ? ', ' + x.c.s : ''}:\n${x.c.t}`).join('\n\n') : '(no passages from the pilot\'s documents matched)';
      return `You are an experienced flight instructor answering inside Birdbird, beside the pilot's own documents. Answer only from the excerpts. Never invent a limitation, speed, procedure step, callout or performance value: if the excerpts do not contain it, say plainly that you cannot find it in their documents and where they should look. Keep manufacturer documentation and operator documentation apart.
Write in ${window.NAI.langName()} and keep aviation terms, speeds and checklist items in English. Be short and concrete: two to six sentences or a short list.
SOURCES (excerpts from the pilot's own documents):
${ex}

CITATION RULES: after every statement that comes from a source, cite it as [S1], [S2] and so on. Only cite sources listed above. Anything not from a source is marked [GK] and must never be a limitation, speed, procedure step or performance value.
${hist ? 'CONVERSATION SO FAR:\n' + hist + '\n' : ''}PILOT NOW: ${question}`;
    }
    async function ask(question) {
      question = String(question || '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q); if (!question || busy) return;
      const docs = docsInScope().map(d => Object.assign({}, S.docs[d.id], { id: d.id, name: d.name, rev: d.rev || S.docs[d.id].rev || '' }));
      const hits = search(question, 6, docs).map(x => Object.assign(x, { label: X.pdfLabel(x.d.id, x.c.p) }));
      const turn = { q: question, a: '', src: hits, pending: true }; chat.turns.push(turn); if (chat.turns.length > MAX_TURNS) chat.turns.shift();
      drawBar(); drawLog(); sc.scrollTop = sc.scrollHeight;
      const ok = await check();
      if (!alive) return;
      if (!ok) { const top = hits.length ? hits[0].s : 0; turn.src = hits.filter(x => x.s >= top * 0.6).slice(0, 5); turn.pending = false; turn.local = true; drawLog(); sc.scrollTop = sc.scrollHeight; return; }
      if (!docs.length) { turn.pending = false; turn.err = scope === 'doc' ? t('Open a document beside this tab, or ask all your documents.', 'Åpne et dokument ved siden av denne fanen, eller spør alle dokumentene dine.') : t('There is no document text to answer from in this choice. Add documents or choose all your documents.', 'Det finnes ingen dokumenttekst å svare fra i dette valget. Legg til dokumenter eller velg alle dokumentene dine.'); drawLog(); return; }
      const hist = chat.turns.slice(-5, -1).filter(x => x.a).map(x => 'PILOT: ' + x.q.slice(0, 600) + '\nINSTRUCTOR: ' + x.a.slice(0, 900)).join('\n');
      busy = new AbortController(); setBusy(true);
      const el = () => log.querySelector(`.ask-a[data-i="${chat.turns.indexOf(turn)}"]`);
      try {
        const out = await window.NAI.text(prompt(question, hits, hist), { signal: busy.signal, tier: 'default', onText: ({ text }) => { turn.a = text; const e = el(); if (e && alive) e.innerHTML = md(text, hits); } });
        turn.a = String(out || '').replace(/\n-{3,}[\s\S]*$/, '').trim();
      } catch (e) {
        if (e && e.code === 'not_available') { avail = false; turn.local = true; }
        else if (!(e && e.code === 'cancelled')) turn.err = window.NAI.errText(e);
        else turn.err = t('Stopped.', 'Stoppet.');
        if (window.NAI.fatal(e)) avail = false;
      } finally { turn.pending = false; busy = null; if (alive) { setBusy(false); drawLog(); const e = el(); if (e) e.scrollIntoView({ block: 'nearest' }); } }
    }
    function setBusy(b) { form.querySelector('[type=submit]').disabled = b; form.querySelector('[data-a="stop"]').hidden = !b; }
    form.addEventListener('submit', e => { e.preventDefault(); const v = q.value; q.value = ''; ask(v); });
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } e.stopPropagation(); });
    form.addEventListener('click', e => { if (e.target.closest('[data-a="stop"]') && busy) busy.abort(); });
    bar.addEventListener('click', e => {
      const s = e.target.closest('[data-s]'); if (s && !s.disabled) { scope = s.dataset.s; M.ask.scope = scope; A.saveMeta(); drawBar(); return; }
      if (e.target.closest('[data-a="clear"]')) { chat.turns = []; drawBar(); drawLog(); }
    });
    bar.addEventListener('change', e => { if (e.target.classList.contains('ask-ac')) { acId = e.target.value; M.ask.ac = acId; A.saveMeta(); drawBar(); } });
    log.addEventListener('click', e => {
      const c = e.target.closest('.ask-src'); if (c) { ctx.jumpTo(c.dataset.doc, +c.dataset.p || 1); return; }
      const b = e.target.closest('[data-a]'); if (!b) return; const x = chat.turns[+b.dataset.i];
      if (b.dataset.a === 'add') A.pickFiles({});
      else if (b.dataset.a === 'copy' && x) { try { navigator.clipboard.writeText(plain(x.a, x.src)); A.toast(t('Copied.', 'Kopiert.')); } catch (er) {} }
      else if (b.dataset.a === 'note' && x) {
        const used = [...new Set((x.a.match(/\[S(\d{1,2})\]/g) || []).map(m => +m.slice(2, -1)))].map(n => x.src[n - 1]).filter(Boolean);
        const refs = used.map(s => X.D.citeHtml(s.d.id, s.c.p, s.label, A.item(s.d.id) ? A.item(s.d.id).name : s.d.name)).join(' ');
        const text = plain(x.a.replace(/\[S\d{1,2}\]/g, ''), x.src).split(/\n+/).map(l => W.sanitizeHtml(esc(l))).join('<br>');
        ctx.quote(`<blockquote><b>${esc(x.q)}</b><br>${text}${refs ? '<br>' + refs : ''}</blockquote>`, used[0] ? used[0].d.id : null, used[0] ? used[0].c.p : null);
      }
    });
    drawBar(); drawLog(); check();
    if (chat.turns.length) requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
    setTimeout(() => { if (alive && !X.isPhone()) q.focus({ preventScroll: true }); }, 60);
    const view = {
      ctxChanged() { if (alive) drawBar(); },
      refresh() { if (alive && !busy) drawBar(); },
      toDoc() { scope = 'doc'; drawBar(); setTimeout(() => { if (alive) q.focus({ preventScroll: true }); }, 30); },
      destroy() { alive = false; liveViews.delete(view); if (busy) busy.abort(); }
    };
    liveViews.add(view);
    return view;
  }

  window.WSASK = { init(x) { X = x; }, mountAsk, setDoc(id) { lastDoc = id || null; wantDoc = !!id; if (id) liveViews.forEach(v => { v.toDoc(); wantDoc = false; }); }, _search: search, _md: md };
})();
