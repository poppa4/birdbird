/* NORDAP – Flight Intelligence, the short answer: the prompt and the answer formatting shared by the front-page box
   (front-fi.js) and the search bar (search.js). Needs ai.js (NAI), easa.js (EASA) and theory.js (THEORY) at call time.
   FIQ.prompt(q, list, easy, th, turns, where) → the text sent to /api/atc; FIQ.md(text, list, th, gkLabel) → HTML. */
(function (G) {
'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EASY = 'The pilot finds your last answer hard to follow. Explain the same thing again in plain language: start with the core idea in one or two short sentences; use short sentences and everyday words; explain every abbreviation the first time you use it (for example RVR = how far you can see along the runway); give one concrete example with real numbers, or one simple comparison; end with one line on what it means in practice for the pilot. Keep exactly the same facts, numbers, rule IDs and citations as your last answer. Do not add new rules, numbers or exceptions, and do not leave out a condition that changes the answer.';
function prompt(q, list, easy, th, turns, where) {
    const hist = (turns || []).slice(-5, -1).filter(t => t.a).map(t => 'PILOT: ' + t.q.slice(0, 800) + '\nFLIGHT INTELLIGENCE: ' + t.a.slice(0, 1200)).join('\n');
    return `You are Flight Intelligence, the AI instructor of NORDAP (the Nordic Aviation Platform), answering a pilot on NORDAP's ${where || 'front page'}. Answer any aviation question clearly, like a good flight instructor: aerodynamics, meteorology, systems, navigation, procedures and EASA rules.
Write in ${NAI.langName()} and keep aviation terms in English. Be concrete and short: at most a few short paragraphs or a short list. No tables.
${th && th.length && window.THEORY ? THEORY.promptBlock(th) + '\n\n' : ''}${list.length ? EASA.promptBlock(list) : EASA.noMatch()}

RULES FOR THIS ANSWER: Mark every statement that does not come from an EASA entry or a theory entry above with [GK] (general knowledge), once at the end of the sentence. Never give aircraft-specific limitations, speeds or procedure steps from memory: say that Flight Intelligence can answer that from the pilot's own AFM and SOP on the Flight Intelligence page. If the question contains a wrong premise (a wrong number, a rule that does not exist), correct it. Calculations the pilot asks for (descent, wind, fuel, time, conversions and so on) are allowed and wanted: use the calculator markers described in your instructions; a calculated result is not [GK].
${hist ? '\nCONVERSATION SO FAR:\n' + hist + '\n' : ''}
${easy ? 'PILOT NOW: (asks you to explain your last answer more simply)\n' + EASY : 'PILOT: ' + q.slice(0, 1500)}`;
  }
function md(text, list, th, gk) {
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
    h = h.replace(/\[GK\]/g, `<span class="gk">${esc(gk || 'general knowledge')}</span>`).replace(/\[S\d+\]/g, '');
    h = window.THEORY ? THEORY.cite(h, th || []) : h.replace(/\[T\d+\]/g, '');
    return window.EASA ? EASA.cite(h, list) : h;
  }
G.FIQ = { EASY, prompt, md };
})(window);
