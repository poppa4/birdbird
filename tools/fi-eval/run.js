/* NORDAP – Flight Intelligence quality test. Runs in the browser on https://nordap.eu/ (the front page), with the exact
   prompt the front page sends (window.NORDAP_FI.build), against the real model through /api/atc, using the eval key
   (header x-nordap-eval; see EVAL_KEY_SHA256 in functions/api/atc.js). Not served by the site (/tools/* answers 404).
   Usage in the page console: FIEVAL.start(KEY[, ids][, 'baseline']) → later FIEVAL.report(). 'baseline' turns off the
   hard-rules reminder and the reference check, so their effect can be measured in the same deployment. Each run uses about 30 of the day's questions.
   Every answer is graded automatically:
     must  every pattern must match (each entry: one regex, or an array where any one may match)
     not   no pattern may match
     num   for each [value, tolerance]: some number in the answer must be within tolerance
   and globally: no LaTeX, no failed calculator marker, no made-up reference (marked "unverified" by the server),
   no U.S. rule or unit, not empty. */
(function () {
'use strict';
const Q = [
  /* ---- 081 principles of flight ---- */
  { id: 'pof-induced', q: 'What is induced drag and why does it get smaller as speed increases?', must: [/vortex|vortices|downwash/i, [/angle of attack/i, /lift coefficient|C_?L\b/i]] },
  { id: 'pof-turn-stall', lang: 'no', q: 'Hvorfor øker steilefarten i en sving?', must: [[/lastfaktor/i, /load factor/i], [/kvadratrot/i, /square root/i, /√/]] },
  { id: 'pof-60bank', q: 'Wings-level stall speed is 50 kt. What is the stall speed in a level 60° banked turn?', num: [[70.7, 1]] },
  { id: 'pof-ground-effect', lang: 'no', q: 'Hva er bakkeeffekt?', must: [[/vingespenn/i, /wingspan/i], [/induser|indusert|induc/i, /induced/i]] },
  { id: 'pof-heavy-glide', q: 'Does a heavier aircraft glide further than a light one?', must: [[/same (glide )?(angle|distance|ratio|range)/i, /does not glide further/i, /not further/i, /no[,.]/i]], not: [/heavier aircraft (will )?glides? further/i] },
  { id: 'pof-left-yaw', q: 'Why does a single-engine aircraft with a clockwise propeller yaw left on take-off?', must: [[/p-factor/i, /asymmetric blade/i], /slipstream/i] },
  { id: 'pof-trap-transit', q: 'Since equal transit time explains lift, how can aerobatic aircraft fly upside down?', must: [[/equal.transit[^.]*(wrong|incorrect|myth|false|not (true|correct)|misconception)/i, /(wrong|incorrect|myth|false|misconception)[^.]*equal.transit/i, /does not explain|doesn't explain/i]], must2: [/angle of attack/i] },
  /* ---- 050 meteorology ---- */
  { id: 'met-cb-conditions', q: 'What three conditions are needed for a thunderstorm to form?', must: [/moist/i, /unstable|instability/i, /lift|trigger/i] },
  { id: 'met-fog', lang: 'no', q: 'Hva er forskjellen på strålingståke og adveksjonståke?', must: [[/klar(e)? (natt|himmel)/i, /klarvær/i, /skyfri/i, /clear/i], [/kald(ere)? (overflate|sjø|hav|bakke|underlag)/i, /colder surface/i, /kaldt underlag/i, /kaldere/i]] },
  { id: 'met-cloud-base', q: 'Surface temperature is 15 °C and the dew point is 7 °C. Estimate the base of cumulus cloud.', num: [[3200, 300]] },
  { id: 'met-microburst', q: 'What happens to an aircraft that flies through a microburst on final approach?', must: [/head\W?wind/i, /tail\W?wind/i, /down\W?draft|downdraught|sink/i] },
  { id: 'met-icing', lang: 'no', q: 'Ved hvilke temperaturer er faren for ising på flyet størst, og hvorfor?', must: [[/underkjøl|superkjøl/i, /super\W?cooled/i], [/-\s?15|−\s?15|-\s?10|−\s?10|-\s?20|−\s?20/]] },
  { id: 'met-dalr', q: 'What is the dry adiabatic lapse rate?', must: [[/3\s?°?\s?C/i, /9\.8\s?°?\s?C/i, /10\s?°?\s?C\s*(per|\/)\s*km/i]] },
  /* ---- 022 instruments ---- */
  { id: 'ins-static-block', q: 'My static ports block during a climb. What do the altimeter, VSI and airspeed indicator show?', must: [[/freez/i, /stuck/i, /constant/i, /stays? at/i], [/zero/i, /\b0\b/], [/(airspeed|ASI)[^]{0,400}?(low|decreas|less|under)/i]] },
  { id: 'ins-unos', lang: 'no', q: 'Forklar UNOS og ANDS på magnetkompasset.', must: [/nord|north/i, /sør|south/i, [/akselerasjon|akselerer/i, /accelerat/i]] },
  { id: 'ins-high-low', q: 'I fly from high to low pressure without changing the altimeter setting. Am I higher or lower than indicated?', must: [/lower/i], not: [/you (are|will be) higher than (indicated|shown)/i] },
  { id: 'ins-airspeeds', q: 'What is the difference between IAS, CAS, EAS and TAS?', must: [/compressib/i, /density/i, [/position|installation|instrument error/i]] },
  /* ---- navigation and calculations ---- */
  { id: 'nav-1in60', q: 'After 50 NM I am 5 NM left of track, with 100 NM still to go. How many degrees must I alter heading to fly direct to the destination?', num: [[9, 0.6]] },
  { id: 'nav-xwind', q: 'Runway 27, wind 310/25 kt. What are the crosswind and headwind components?', num: [[16.1, 0.6], [19.2, 0.6]] },
  { id: 'nav-tod', q: 'Cruising at FL350, I must be at 3000 ft over the fix. Using 3 NM per 1000 ft, how far before the fix should I start descending?', num: [[96, 1]] },
  { id: 'nav-rod', lang: 'no', q: 'Hvilken synkerate trenger jeg for en 3° glidebane med 140 kt bakkefart?', num: [[743, 45]] },
  { id: 'nav-dme', q: 'I pass directly over a VOR/DME at 6000 ft. What does the DME show, and why?', must: [/slant/i], num: [[1, 0.1]] },
  { id: 'nav-false-gp', lang: 'no', q: 'Hva er falske glidebaner på ILS, og hvordan unngår jeg dem?', must: [[/under|nedenfra/i, /below/i]] },
  /* ---- 040 / 021 ---- */
  { id: 'hpl-tuc', q: 'What is the time of useful consciousness and what affects it?', must: [/altitude/i, [/decompression/i, /activity|exercise|workload|fitness|smok|health/i]] },
  { id: 'hpl-somatogravic', lang: 'no', q: 'Hva er en somatogravisk illusjon?', must: [[/akselerasjon|akselerer/i, /accelerat/i], [/nese(n)? opp/i, /stig/i, /nose.?up/i, /pitch.?up/i]] },
  { id: 'sys-carb-ice', q: 'Can carburettor icing happen when the outside air temperature is +20 °C?', must: [/\byes\b|\bcan\b/i], not: [/^no\b/i, /cannot (occur|happen|form)/i] },
  /* ---- rules and traps ---- */
  { id: 'rule-far', q: 'What does FAR 91.155 say about VFR visibility minima in Norway?', must: [/EASA|SERA/i], not: [/FAR 91\.155 (says|requires|states)(?![^.]*(not|n't))/i] },
  { id: 'rule-vmc-trap', lang: 'no', q: 'Jeg har hørt at VMC-minima i luftrom klasse G under 3000 ft er 10 km sikt. Stemmer det?', must: [/5\s?km/i, [/nei\b/i, /stemmer ikke/i, /ikke riktig/i, /feil/i]] },
  { id: 'rule-fuel-nco', q: 'What is the minimum fuel for a VFR day flight in a light aeroplane under Part-NCO?', must: [/NCO\.OP\.125/i, /30\s?min/i] },
  /* ---- general ---- */
  { id: 'gen-jet', q: 'Who invented the jet engine?', must: [/Whittle|von Ohain/i] }
];
const GLOBAL = [
  ['latex', /\\\[|\\\(|\\frac|\\text\{|\\times|\$\$/],
  ['calc-fail', /= \?\)/],
  ['made-up-ref', /\(unverified – check|\(ikke bekreftet – sjekk/],
  ['us-rule-or-unit', /°F|\binHg\b|\bFahrenheit\b|\(U\.S\. rule|\(amerikansk regel/]
];
const nums = t => (String(t).replace(/(\d)[   ](\d{3})\b/g, '$1$2').match(/-?\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
const any = (pat, t) => Array.isArray(pat) ? pat.some(r => r.test(t)) : pat.test(t);
function grade(x, text) {
  const fails = [];
  if (!text || !text.trim()) return ['empty'];
  for (const [k, re] of GLOBAL) if (re.test(text)) fails.push(k);
  (x.must || []).concat(x.must2 || []).forEach((p, i) => { if (!any(p, text)) fails.push('missing#' + i); });
  (x.not || []).forEach((p, i) => { if (p.test(text)) fails.push('wrong#' + i); });
  const N = nums(text); (x.num || []).forEach(([v, tol]) => { if (!N.some(n => Math.abs(n - v) <= tol)) fails.push('number ' + v); });
  return fails;
}
const S = { results: [], running: false };
async function one(key, x, variant) {
  const t0 = Date.now(); let text = '', err = '';
  try {
    const prompt = window.NORDAP_FI.build(x.q, x.lang || 'en');
    const r = await fetch('/api/atc', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', 'x-nordap-eval': key }, variant ? { 'x-nordap-eval-variant': variant } : {}), body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) });
    const j = await r.json(); if (j.ok) text = j.text; else err = r.status + ' ' + (j.error || '');
  } catch (e) { err = String(e && e.message || e); }
  const fails = err ? ['error ' + err] : grade(x, text);
  return { id: x.id, ok: !fails.length, fails, ms: Date.now() - t0, text };
}
async function start(key, only, variant) {
  if (S.running) return 'already running';
  S.running = true; S.results = []; S.t0 = Date.now();
  await window.NORDAP_FI.deps();
  for (const x of Q) { if (only && !only.includes(x.id)) continue; const r = await one(key, x, variant); S.results.push(r); if (/429/.test(r.fails.join(' '))) break; await new Promise(f => setTimeout(f, 5500)); }
  S.running = false; return report();
}
function report(full) {
  const R = S.results, ok = R.filter(r => r.ok).length;
  return { done: !S.running, passed: ok + '/' + R.length, minutes: Math.round((Date.now() - S.t0) / 6e4), failed: R.filter(r => !r.ok).map(r => ({ id: r.id, fails: r.fails, text: full ? r.text : r.text.slice(0, 300) })),
    avgSeconds: R.length ? Math.round(R.reduce((a, r) => a + r.ms, 0) / R.length / 1000) : 0 };
}
window.FIEVAL = { Q, grade, start, report, results: () => S.results };
})();
