/* NORDAP – flow trainer: flows read out of a whole manual (FCTM, FCOM SOP, company SOP, QRH) uploaded as a PDF.
   Everything runs in the browser; the manual never leaves the device.
   read(file)        → the text of every page, as positioned pieces (pdf.js, already used for cockpit pages)
   find(doc)         → the flows in it: a title, a flight phase, the roles (PF/PM, CM1/CM2 or one pilot) and the steps
   place(steps, ac)  → each step matched by name to a named control on a NORDAP cockpit, so it is placed by itself
   The finding is pure and runs in Node too (tools/flowpdf-test.mjs). */
(function (G) {
'use strict';

/* ---------- words ---------- */
const STATE = /^(ON|OFF|AUTO|ARM(ED)?|NORM(AL)?|OPEN|CLOSE[D]?|SET|CHECK(ED|S)?|CHK|TEST(ED)?|UP|DOWN|IN|OUT|PUSH(ED)?|PULL(ED)?|ON\s*\/\s*OFF|AS\s+RQRD|AS\s+REQUIRED|AS\s+RQD|RQRD|REQUIRED|ADVISE|ANNOUNCE|CALL|CONFIRM(ED)?|VERIFY|VERIFIED|COMPLETED?|DONE|START(ED)?|STOP(PED)?|RUN(NING)?|IDLE|RETRACT(ED)?|EXTEND(ED)?|ENGAGE(D)?|DISENGAGE(D)?|RESET|SELECT(ED)?|INSERT(ED)?|REMOVE(D)?|STOW(ED)?|LOCK(ED)?|UNLOCK(ED)?|BRIGHT|DIM|ALIGN|NAV|BOTH|AS\s+DESIRED|MAX|MIN|OBTAIN(ED)?|RECEIVED|PERFORM(ED)?|PREPARE(D)?|REVIEW(ED)?|BRIEF(ED)?|TOGA|FLX|CL|ACCEPT(ED)?|CANCEL(LED)?|CLEAR(ED)?)\b/i;
const ROLE_RX = /^(PF|PM|PNF|CM\s?1|CM\s?2|CAPT(AIN)?|CPT|F\/O|FO|FIRST OFFICER|PILOT FLYING|PILOT MONITORING|PILOT NOT FLYING|BOTH|ALL|BOTH PILOTS)$/i;
function roleOf(s) { const t = String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (/^(PF|PILOT FLYING)$/.test(t)) return 'PF'; if (/^(PM|PNF|PILOT MONITORING|PILOT NOT FLYING)$/.test(t)) return 'PM';
  if (/^(CM ?1|CAPT(AIN)?|CPT)$/.test(t)) return 'CM1'; if (/^(CM ?2|F\/O|FO|FIRST OFFICER)$/.test(t)) return 'CM2'; if (/^(BOTH|ALL|BOTH PILOTS)$/.test(t)) return '*'; return null; }
/* a role named inside a title: "AFTER START – PM", "PF FLOW", "COCKPIT PREPARATION (CAPT)" */
function roleInTitle(t) { const m = /(?:^|[\s(\[–—\-:\/])(PF|PM|PNF|CM ?1|CM ?2|CAPT(?:AIN)?|CPT|F\/O|FO|FIRST OFFICER|PILOT FLYING|PILOT MONITORING)(?=$|[\s)\]–—\-:\/])/i.exec(String(t || '')); return m ? roleOf(m[1]) : null; }
/* flight phases (the ids of F.PHASES), first match wins */
const PHASE_KW = [['abn', /\b(MEMORY ITEMS?|ABNORMAL|EMERGENCY|NON[- ]NORMAL|QRH|REJECTED TAKE ?OFF|RTO|EVACUATION|ENGINE FAIL|WINDSHEAR|EGPWS|TCAS|STALL RECOVERY|UNRELIABLE)\b/i],
  ['aldg', /\bAFTER LANDING\b/i], ['shut', /\b(PARKING|SECURING|SHUT ?DOWN|LEAVING THE AIRCRAFT|TERMINATION|POWER DOWN)\b/i],
  ['ldg', /\b(LANDING|GO[- ]AROUND|MISSED APPROACH|TOUCHDOWN|FLARE)\b/i], ['app', /\b(APPROACH|FINAL)\b/i], ['des', /\b(DESCENT|TOP OF DESCENT|ARRIVAL)\b/i],
  ['crz', /\bCRUISE\b/i], ['clb', /\b(AFTER TAKE ?OFF|CLIMB|TRANSITION ALTITUDE)\b/i], ['bto', /\b(BEFORE TAKE ?OFF|LINE ?UP|TAKE ?OFF|RUNWAY ENTRY)\b/i],
  ['taxi', /\bTAXI/i], ['ast', /\b(AFTER START|ENGINE START|ENGINES? START|STARTING)\b/i], ['bst', /\b(BEFORE START|BEFORE PUSH|PUSH ?BACK|PUSH AND START)\b/i],
  ['pre', /\b(COCKPIT PREP(ARATION)?|PRELIMINARY|SAFETY (CHECK|INSPECTION)|EXTERIOR|WALK ?AROUND|ORIGINATING|POWER ?UP|RECEIVING|FLIGHT DECK PREP(ARATION)?|PREFLIGHT|PRE-?FLIGHT)\b/i]];
const phaseOf = t => { for (const [id, rx] of PHASE_KW) if (rx.test(t)) return id; return ''; };
const FLOWWORD = /\b(FLOWS?|PROCEDURES?|SCAN|CHECKLIST|SEQUENCE|DUTIES|TASKS)\b/i;

/* ---------- lines out of positioned pieces ---------- */
/* page: { w, h, items: [{ s, x, y (from the top), w, h }] } → lines: { p, y, h, segs: [{ x, x2, s }], text } */
function lines(page, p) { const it = page.items.filter(i => i.s && i.s.trim()).sort((a, b) => a.y - b.y || a.x - b.x), out = [];
  it.forEach(i => { const L = out.length && out[out.length - 1], tol = Math.max(1.5, Math.min(i.h || 8, 14) * 0.45);
    if (L && Math.abs(L.y - i.y) <= tol) L.it.push(i); else out.push({ p, y: i.y, h: i.h || 8, it: [i] }); });
  return out.map(L => { L.it.sort((a, b) => a.x - b.x); const h = Math.max(...L.it.map(i => i.h || 8)), segs = [];
    L.it.forEach(i => { const s = segs[segs.length - 1], gap = s ? i.x - s.x2 : 0;
      if (s && gap < h * 1.6) { s.s += (gap > h * 0.12 && !/\s$/.test(s.s) && !/^\s/.test(i.s) ? ' ' : '') + i.s; s.x2 = Math.max(s.x2, i.x + (i.w || 0)); }
      else segs.push({ x: i.x, x2: i.x + (i.w || i.s.length * h * 0.5), s: i.s }); });
    segs.forEach(s => { s.s = s.s.replace(/\s+/g, ' ').trim(); });
    const sg = segs.filter(s => s.s); return { p, y: L.y, h, segs: sg, text: sg.map(s => s.s).join('   '), W: page.w || 600, H: page.h || 800 }; }).filter(l => l.segs.length); }

/* running headers and footers (the manual's name, revision, page numbers) repeat on many pages near the top or bottom */
function dropRunning(L, pages) { if (pages < 4) return L; const key = l => l.text.toUpperCase().replace(/\d+/g, '#').replace(/\s+/g, ' '), n = new Map();
  L.forEach(l => { if (l.y < l.H * 0.12 || l.y > l.H * 0.88) { const k = key(l); if (!n.has(k)) n.set(k, new Set()); n.get(k).add(l.p); } });
  const lim = Math.max(3, pages * 0.25); return L.filter(l => !((l.y < l.H * 0.12 || l.y > l.H * 0.88) && n.get(key(l)) && n.get(key(l)).size >= lim)); }

/* ---------- one line → zero, one or two items ---------- */
const upperish = s => { const a = s.replace(/[^A-Za-z]/g, ''); return a.length > 0 && a.replace(/[^A-Z]/g, '').length / a.length >= 0.6; };
const words = s => s.trim().split(/\s+/).length;
const BULLET = /^(\(?\d{1,3}[.)]|\(?[a-z][.)]|[-–•*·▪►>✓☐□■◦○]|\[\s?\])\s*/;
function cleanName(s) { return s.replace(BULLET, '').replace(/^\d{1,2}\s+(?=[A-Za-z]{2})/, '').replace(/[\s.…:_·]+$/, '').replace(/\s+/g, ' ').trim(); }
function okName(n) { return n.length >= 2 && n.length <= 70 && /[A-Za-z]/.test(n) && words(n) <= 10 && !/[.!?]$/.test(n) && !/^(NOTE|CAUTION|WARNING|REMARK|REF|SEE|IF|WHEN|THE|THIS|IN|ON|AT)\b/i.test(n); }
function okState(st) { st = st.trim(); return st.length >= 1 && st.length <= 40 && words(st) <= 7 && (STATE.test(st) || upperish(st) || /^[\d.,\/°%\-+ ]+[A-Za-z%°]{0,6}$/.test(st)) && !/[.!?]$/.test(st.replace(/\.{2,}$/, '')); }
function pair(segs) { // segments of one item (left to right) → { n, st, r }
  segs = segs.slice(); let r = null;
  for (let i = segs.length - 1; i >= 0; i--) if (ROLE_RX.test(segs[i].s.trim())) { r = r || roleOf(segs[i].s); segs.splice(i, 1); }
  if (segs.length > 1 && labelNum(segs[0].s) && /[A-Za-z]/.test(segs[1].s)) segs.shift(); // "1   BAT 1+2 ..... ON": the legend number of a figure
  if (!segs.length) return null; const t = segs.map(s => s.s).join('   ');
  if (header(segs)) return null;
  if (segs.every(x => /^(ITEM|ITEMS|ACTION|ACTIONS|PILOT|CREW|CREW MEMBER|BY|ROLE|RESPONSE|CHALLENGE|STATUS|POSITION|STATE|CONTROL|STEP|NO\.?|#|REMARKS?|REF(ERENCE)?)$/i.test(x.s.trim()))) return null;
  let m = /^(.+?)\s*(?:\.{2,}|(?:\.\s+){2,}\.?|…+|_{3,}|·{3,}|-{4,})\s*(.+)$/.exec(t); // BATTERY ........ ON
  if (m) { const n = cleanName(m[1]), st = m[2].replace(/^[.…\s]+/, '').replace(/^"|"$/g, '').trim(); return okName(n) && st && st.length <= 40 ? { n, st, r } : null; }
  if (segs.length >= 2) { const st = segs[segs.length - 1].s, n = cleanName(segs.slice(0, -1).map(s => s.s).join(' ')); // BATTERY        ON (a table)
    if (okName(n) && okState(st) && (upperish(n) || STATE.test(st))) return { n, st, r }; return null; }
  m = /^(.+?\S)\s+[–—]\s+(\S.*)$/.exec(t) || /^(.+?\S)\s+-\s+(\S.*)$/.exec(t) || /^([A-Z0-9][A-Z0-9 &\/+().'-]{1,60}):\s+(\S.*)$/.exec(t); // BEACON – ON / BEACON: ON
  if (m) { const n = cleanName(m[1]), st = m[2].trim(); if (okName(n) && okState(st) && upperish(n)) return { n, st, r }; }
  const q = /^(?:call|request|ask for|read)\s+["“]?([^"”]*checklist)\.?["”]?\.?$/i.exec(t); if (q) return { n: q[1].toUpperCase(), st: '', r, call: true };
  if (/checklist/i.test(t) && words(t) <= 8 && !/[.!?]$/.test(t)) { const n = cleanName(t.replace(/\s*[–—-]\s*(call|request|read|complete)\w*\s*$/i, '')); if (okName(n)) return { n, st: '', r, call: true }; } // BEFORE START CHECKLIST
  return null; }
function items(l) { // two items side by side (PF left, PM right): split where the page splits, if both halves read as items
  const mid = l.W / 2, Lh = l.segs.filter(s => s.x2 <= mid + 4), Rh = l.segs.filter(s => s.x >= mid - 4);
  if (Lh.length && Rh.length && Lh.length + Rh.length === l.segs.length) { const a = pair(Lh), b = pair(Rh); if (a && b) { a.col = Lh[0].x; b.col = Rh[0].x; return [a, b]; } }
  const one = pair(l.segs); if (one) one.col = l.segs[0].x; return one ? [one] : []; }

/* role heading: a line that is only a role ("PF", "PM TASKS"), or a table head with two roles ("PF   PM") */
function roleHead(l) { const S = l.segs.map(s => s.s.trim().replace(/\s+(TASKS?|FLOWS?|ACTIONS?|DUTIES|SIDE)$/i, ''));
  if (S.length && S.every(s => ROLE_RX.test(s))) { const R = S.map((s, i) => ({ r: roleOf(s), x: l.segs[i].x })).filter(x => x.r && x.r !== '*'); return R.length ? R : null; }
  if (S.length >= 2 && S.length <= 4 && S.filter(s => ROLE_RX.test(s)).length >= 2 && S.every(s => ROLE_RX.test(s) || /^(ITEM|ACTION|STEP|CONTROL|PANEL|NO\.?|#|SWITCH|SELECTOR|POSITION|STATE)$/i.test(s))) {
    const R = S.map((s, i) => ({ r: roleOf(s), x: l.segs[i].x })).filter(x => x.r && x.r !== '*'); return R.length >= 2 ? R : null; }
  return null; }
const HEADWORDS = /^(ITEM|ITEMS|ACTION|ACTIONS|PILOT|CREW|CREW MEMBER|BY|ROLE|RESPONSE|CHALLENGE|STATUS|POSITION|STATE|CONTROL|STEP|NO\.?|#|REMARKS?|REF(ERENCE)?|PF|PM|CM ?1|CM ?2)$/i;
const header = segs => segs.length >= 2 && segs.every(x => HEADWORDS.test(x.s.trim()));
function heading(l, body) { if (header(l.segs)) return false; const t = l.text.replace(/\s{2,}/g, ' ').trim(); if (t.length < 3 || t.length > 90 || !/[A-Za-z]{3}/.test(t) || /[.,;]$/.test(t) || words(t) > 12) return false;
  return upperish(t) || l.h >= body * 1.15; }
function titleCase(t) { return t.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s(\/–-])([a-z])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(Pf|Pm|Cm1|Cm2|Fo|Capt|Apu|Atc|Qrh|Sop|Ils|Rnav|Rnp|Fms|Fmgs|Mcdu|Fmc|Ecam|Eicas|Efb|Toga|Flx|Ctot|Atis|Adirs?|Irs|Gpws|Egpws|Tcas|Ram|Rto|Etops)\b/g, m => m.toUpperCase())
  .replace(/\b(And|Or|Of|The|To|For|In|On|At|With)\b/g, (m, a, o) => o ? m.toLowerCase() : m); }
function cleanTitle(t) { return titleCase(String(t || '').replace(/(^|\s[–—-]\s)\s*(\d+(\.\d+)*\.?|[A-Z]\d*(\.\d+)+|[IVX]+\.|[A-Z]{1,4}(-[A-Z]{1,6})*-\d+[A-Z]?(-\d+)*|DSC-[\d-]+)\s+/g, '$1').replace(/\s*[\(\[]?\s*(PF|PM|PNF|CM ?1|CM ?2|CAPT(AIN)?|CPT|F\/O|FO|PILOT FLYING|PILOT MONITORING)\s*[\)\]]?\s*$/i, '').replace(/\s*[–—:\-]\s*$/, '')).trim(); }

/* ---------- the flows of a whole manual ---------- */
/* doc: { pages: [{ w, h, items }] } → [{ name, phase, rs, roles, steps: [{ r, t, k }], page }] */
function find(doc, opt) { opt = opt || {}; const P = doc.pages || [];
  let L = []; P.forEach((pg, i) => { L = L.concat(lines(pg, i + 1)); }); L = dropRunning(L, P.length);
  const hs = L.map(l => l.h).sort((a, b) => a - b), body = hs.length ? hs[Math.floor(hs.length / 2)] : 9;
  const out = []; let B = null, gap = 0, role = null, cols = null, heads = [];
  const close = () => { if (B && B.steps.filter(s => s.k === 'act').length >= (opt.min || 3)) out.push(B); B = null; gap = 0; };
  const titleFor = i => { const near = heads.filter(h => i - h.i <= 45 && h.p >= L[i].p - 1); if (!near.length) return '';
    const top = near.slice().reverse().find(h => phaseOf(h.t)) || near.slice().reverse().find(h => FLOWWORD.test(h.t)) || near[near.length - 1], last = near[near.length - 1];
    // "Cockpit preparation" above "Overhead panel scan": both, the phase first
    return last !== top && last.i > top.i && !roleInTitle(last.t) && !phaseOf(last.t) ? top.t + ' – ' + last.t : top.t; };
  L.forEach((l, i) => {
    const R = roleHead(l); if (R) { if (R.length === 1) { role = R[0].r; cols = null; } else cols = R; gap = 0; return; }
    const its = l.h >= body * 1.25 ? [] : items(l);
    if (its.length) { if (!B) { const t = titleFor(i); B = { title: t, page: l.p, steps: [], role0: roleInTitle(t) }; }
      its.forEach(it => { let r = it.r; if (!r && cols) { let d = Infinity; cols.forEach(c => { const e = Math.abs(c.x - it.col); if (e < d) { d = e; r = c.r; } }); }
        if (!r) r = role || B.role0 || null; B.steps.push({ r, t: it.st ? it.n + ' – ' + it.st : it.n, k: it.call || /\bchecklist\b/i.test(it.n) ? 'call' : 'act' }); });
      gap = 0; return; }
    if (heading(l, body)) { const t = l.text.replace(/\s{2,}/g, ' ').trim();
      if (B && (phaseOf(t) || FLOWWORD.test(t) || l.h >= body * 1.3 || roleInTitle(t))) { close(); role = null; cols = null; }
      else if (B) { gap++; if (gap > 4) close(); }
      heads.push({ i, t, p: l.p }); if (roleInTitle(t) && !B) role = roleInTitle(t); return; }
    if (B) { gap++; if (gap > 3 || (l.p > B.page + 1 && gap > 1)) close(); } });
  close();
  // one flow per title: the PF and PM parts of the same flow, found one after the other, become one flow with two layers
  const flows = []; out.forEach(b => { const name = cleanTitle(b.title) || '', prev = flows[flows.length - 1];
    const nums = b.steps.filter(s => /^[\d.,\/°%\-+ ]+[A-Za-z%°]{0,6}$/.test((s.t.split(' – ')[1] || '').trim())).length; if (nums > b.steps.length * 0.6) return; // a table of figures, not a flow
    if (prev && name && prev.key === name.toLowerCase() && prev.page >= b.page - 3) { prev.steps = prev.steps.concat(b.steps); return; }
    flows.push({ key: name.toLowerCase(), name: name || ('Flow, page ' + b.page), page: b.page, steps: b.steps.slice() }); });
  return flows.map(f => { const used = new Set(f.steps.map(s => s.r).filter(r => r && r !== '*'));
    const rs = [...used].some(r => r === 'CM1' || r === 'CM2') && ![...used].some(r => r === 'PF' || r === 'PM') ? 'cm' : used.size ? 'pfpm' : (opt.crew === 1 ? 'one' : 'pfpm');
    const roles = { pfpm: ['PF', 'PM'], cm: ['CM1', 'CM2'], one: ['P'] }[rs], map = r => { if (rs === 'one') return 'P'; if (!r || r === '*') return roles[0];
      if (rs === 'pfpm') return r === 'CM1' ? 'PF' : r === 'CM2' ? 'PM' : r; return r === 'PF' ? 'CM1' : r === 'PM' ? 'CM2' : r; };
    const steps = []; const seen = new Set(); f.steps.forEach(s => { const r = map(s.r), k = r + '|' + s.t.toUpperCase(); if (seen.has(k)) return; seen.add(k); steps.push({ r, t: s.t.slice(0, 120), k: s.k }); });
    return { name: f.name.slice(0, 80), phase: phaseOf(f.name), rs, roles, steps, page: f.page }; }); }

/* ---------- step names → NORDAP's named controls ---------- */
const SYN = [[/\bBATT?(ERY|ERIES|S)?\b/g, 'BAT'], [/\bENGINES?\b/g, 'ENG'], [/\bFLIGHT\b/g, 'FLT'], [/\bCONTROLS\b/g, 'CONTROL'], [/\bGENERATORS?\b/g, 'GEN'], [/\bLIGHTS?\b|\bLTS\b/g, 'LT'], [/\bSELECTORS?\b/g, 'SEL'], [/\bSWITCH(ES)?\b|\bSW\b|\bP\/?B\b|\bPUSH ?BUTTONS?\b|\bKNOBS?\b/g, ''], [/\bLEVERS?\b/g, 'LVR'], [/\bTHRUST\b/g, 'THR'], [/\bRUDDER\b/g, 'RUD'], [/\bWEATHER\b/g, 'WX'], [/\bOXY(GEN)?\b/g, 'OXYGEN'], [/\bA-ICE\b/g, 'ANTI ICE'], [/\bBRAKES?\b/g, 'BRK'], [/\bSTATUS\b/g, 'STS'], [/\bHEATING\b|\bHEATERS?\b/g, 'HEAT'],
  [/\bPUMPS\b/g, 'PUMP'], [/\bVALVES?\b/g, 'VALVE'], [/\bAUX(ILIARY)? POWER UNIT\b/g, 'APU'], [/\bHYDRAULICS?\b/g, 'HYD'], [/\bELEC(TRICAL|TRICS)?\b/g, 'ELEC'], [/\bPARK(ING)? (BRAKE|BRK)\b/g, 'PARK BRK'],
  [/\bANTI[- ]?ICE\b/g, 'ANTI ICE'], [/\bNO\.? ?(\d)\b/g, '$1'], [/\bNUMBER (\d)\b/g, '$1'], [/\bTRANSPONDER\b|\bXPDR\b|\bATC\b(?! ?(MSG|CLEARANCE|CLR|CLRNC))/g, 'XPDR'], [/\bWINDSHIELD|WINDOW\b/g, 'WINDOW'], [/\bSEAT ?BELTS?\b/g, 'SEAT BELTS'],
  [/\bNO SMOKING\b/g, 'NO SMOKING'], [/\bEMER(GENCY)?\b/g, 'EMER'], [/\bEXTERIOR\b|\bEXT\b/g, 'EXT'], [/\bLANDING\b|\bLDG\b/g, 'LAND'], [/\bTAXI\b/g, 'TAXI'], [/\bNAVIGATION\b/g, 'NAV'], [/\bSTROBES?\b/g, 'STROBE'], [/\bBEACONS?\b/g, 'BEACON'],
  [/\bAUTO ?THRUST\b|\bA\/THR\b|\bATHR\b/g, 'A/THR'], [/\bAUTO ?PILOT\b|\bA\/P\b/g, 'AP'], [/\bFLIGHT DIRECTORS?\b|\bF\/D\b/g, 'FD'], [/\bAUTO ?BRAKES?\b/g, 'AUTO BRK'], [/\bSPEED ?BRAKES?\b|\bSPOILERS?\b/g, 'SPD BRK']];
function norm(s) { let t = ' ' + String(s || '').toUpperCase().replace(/[‘’'"`´]/g, '') + ' '; SYN.forEach(([a, b]) => { t = t.replace(a, b); });
  return t.replace(/[^A-Z0-9\/]+/g, ' ').replace(/\s+/g, ' ').trim(); }
const stem = x => x.length > 3 && /[^S]S$/.test(x) ? x.slice(0, -1) : x;
const toks = s => { const o = []; norm(s).split(' ').filter(Boolean).forEach(x => { o.push(stem(x)); }); const n = new Set(o).size; norm(s).split(' ').forEach(x => { if (x.includes('/')) x.split('/').filter(Boolean).forEach(y => o.push(stem(y))); }); o.n = n; return o; }; // ON/OFF also reads as ON and OFF
/* "BAT 1 & 2", "FUEL PUMPS 1+2", "ENG 1/2 MASTER": the first of the pair is where the hand goes first */
function firstOfPair(n) { return String(n).replace(/\b(\d)(?:\s*(?:&|\+|AND|,|\/)\s*\d\b)+/gi, '$1').replace(/\bALL\b/gi, ' ').replace(/\bBOTH\b/gi, ' '); }
const GENERIC = /^(MASTER|SWITCHE|LT|PUMP|SEL|VALVE|ENG|GEN|BAT|ALL|MODE|TEST|LVR|ON|OFF|AUTO|SYS|IND|CHECK|SET|PANEL|1|2|3|4)$/;
function score(A, B, st, nm) { if (!A.length || !B.length) return 0; const a = new Set(A), b = new Set(B);
  const nA = A.filter(x => /^\d$/.test(x)), nB = B.filter(x => /^\d$/.test(x)); if (nA.length && nB.length && !nA.some(x => b.has(x))) return 0; // BAT 1 is never BAT 2
  if (nm && A.join(' ') === nm.join(' ') || !nm && A.join(' ') === B.join(' ')) return 1.1; // the very name
  const core = [...a].filter(x => !GENERIC.test(x)), key = core.length ? core : [...a]; // "IRS MODE SELECTORS": IRS is what counts
  let hit = 0; a.forEach(x => { if (b.has(x)) hit++; }); const pr = key.filter(x => b.has(x)).length / key.length, pa = hit / a.size, rc = Math.min(1, hit / (B.n || b.size));
  if (pr < 0.66 || pa < 0.3) return 0;
  if (a.size === 1 && (GENERIC.test(A[0]) || rc < 0.25 || (nm && !nm.includes(A[0])))) return 0; // one word must be in the control's own name
  return 0.45 * pr + 0.25 * pa + 0.3 * rc + (pa === 1 ? 0.1 : 0) + (B.some(x => x === 'L' || x === '1' || x === 'CPT') ? 0.005 : 0) + (st && st.some(x => b.has(x) && !a.has(x)) ? 0.08 : 0) + (nm && A.some(x => nm.includes(x)) ? 0.03 : 0); } // AUTO BRK – MAX: the MAX button
/* targets: [{ id, name, panel, x, y, w, h, whole }] (BBFLOWAC.targets) → the best control for a step, or null */
const side = t => toks(t.name).filter(x => !/^(L|R|C|1|2|3|4|CPT|FO|F\/O|LEFT|RIGHT|CTR)$/.test(x)).join(' ');
function match(name, targets) { const parts = String(name || '').split(' – '), A = toks(firstOfPair(parts[0].replace(/\([^)]*\)/g, ' '))), st = toks(parts[1] || ''); if (!A.length) return null;
  const head = A.filter(x => !/^\d$/.test(x) && !/^(SEL|MODE|SYS|PANEL|CONTROL|UNIT|ALL)$/.test(x)).pop(); let best = null, bs = 0, second = 0; // "Fuel pumps" is a pump: the last word must be on the control
  targets.forEach(t => { if (t.whole) return; const nm = toks(t.name), pn = t.panel ? toks(t.panel + ' ' + t.name) : null; if (head && !nm.includes(head) && !(pn && pn.includes(head))) return;
    const s = Math.max(score(A, nm, st), pn ? 0.97 * score(A, pn, st, nm) : 0); if (s > bs + 1e-9) { if (best && side(best) !== side(t)) second = bs; bs = s; best = t; } else if (s > second && best && side(best) !== side(t)) second = s; });
  return bs >= 0.6 ? best : null; } // a tie between two controls ("MASTER": electric, avionic or engine?) is left for a tap
function place(steps, targets) { let n = 0; steps.forEach(s => { if (s.k !== 'act') return; const t = match(s.t, targets); if (t) { s.tg = t.id; s.x = Math.round(t.x + t.w / 2); s.y = Math.round(t.y + t.h / 2); n++; } else { s.x = null; s.y = null; } }); return n; }

/* which aircraft the manual is about: the type named most often */
const ACS = [['b38m', /\b737[- ]?(MAX|8 ?MAX|MAX ?8)\b|\b7M8\b/gi], ['a359', /\bA350\b|\bA359\b/gi], ['b788', /\b787\b/g], ['e190', /\bE[- ]?1[79]0\b|\bE[- ]?JET\b|\bERJ[- ]?190\b|\bEMB[- ]?190\b/gi],
  ['b738', /\b737(-[6-9]00|NG)?\b|\bB73[6-9]\b/g], ['a320', /\bA3(19|20|21|18)\b|\bA32[01N]\b|\bA320 FAMILY\b/gi], ['atr72', /\bATR[- ]?(42|72)?\b/gi], ['b200s', /\bKING ?AIR\b|\bB200\b|\bBE20\b/gi],
  ['da42', /\bDA ?42\b/gi], ['da40', /\bDA ?40\b/gi], ['pa34', /\bPA[- ]?34\b|\bSENECA\b/gi], ['pa28', /\bPA[- ]?28\b|\bWARRIOR\b|\bARCHER\b/gi], ['c172', /\bC?172\b|\bSKYHAWK\b/gi]];
function guessAc(doc) { const t = (doc.pages || []).map(p => p.items.map(i => i.s).join(' ')).join(' '); let best = '', bn = 0;
  ACS.forEach(([id, rx]) => { const n = (t.match(rx) || []).length; if (n > bn) { bn = n; best = id; } }); if (best === 'b738' && (t.match(ACS[0][1]) || []).length > 2) best = 'b38m'; return bn >= 2 ? best : ''; }

/* ---------- flows drawn as figures: numbered callouts (1, 2, 3 …) over a cockpit picture or drawing ---------- */
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳', CIRC2 = '❶❷❸❹❺❻❼❽❾❿⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴', CIRC3 = '➀➁➂➃➄➅➆➇➈➉', CIRC4 = '➊➋➌➍➎➏➐➑➒➓';
function labelNum(s) { s = String(s || '').trim(); if (s.length === 1) { for (const C of [CIRC, CIRC2, CIRC3, CIRC4]) { const i = C.indexOf(s); if (i >= 0) return i + 1; } }
  const m = /^[(\[]?(\d{1,2})[)\].]?$/.exec(s); return m && +m[1] >= 1 && +m[1] <= 60 ? +m[1] : 0; }
const inBox = (x, y, B, pad) => x >= B.x - pad && x <= B.x + B.w + pad && y >= B.y - pad && y <= B.y + B.h + pad;
const union = (A, B) => { if (!A) return Object.assign({}, B); const x = Math.min(A.x, B.x), y = Math.min(A.y, B.y); return { x, y, w: Math.max(A.x + A.w, B.x + B.w) - x, h: Math.max(A.y + A.h, B.y + B.h) - y }; };
/* the callout numbers of one page: a lone number (nothing written right after it), not in the running head or foot.
   A legend line ("1  BAT 1+2 ...... ON") has text after its number, so it is not a callout. */
function callouts(pg) { const W = pg.w || 600, H = pg.h || 800, it = pg.items, out = [];
  it.forEach(i => { const n = labelNum(i.s); if (!n) return; const h = i.h || 8, cx = i.x + (i.w || h * 0.5) / 2, cy = i.y + (i.ocr ? (i.h / 2) : h * 0.5);
    if (!(pg.imgs || []).some(B => inBox(cx, cy, B, 2)) && (cy < H * 0.06 || cy > H * 0.94)) return;
    const after = it.some(j => j !== i && !labelNum(j.s) && /[A-Za-z]/.test(j.s) && Math.abs(j.y - i.y) < h * 0.6 && j.x >= i.x + (i.w || 0) - 1 && j.x <= i.x + (i.w || 0) + h * 2.2);
    if (!after) out.push({ n, x: cx, y: cy, h, r: i.ocr ? h / 2 : h * 0.9, src: i.ocr ? 'ocr' : 'text' }); });
  return out; }
/* 1..N with most of the numbers there; a number found twice keeps the one nearest the others */
function sequence(L) { const by = new Map(); L.forEach(c => { if (!by.has(c.n)) by.set(c.n, []); by.get(c.n).push(c); });
  if (!by.has(1)) return null; let N = 0; for (let n = 1; n <= 60; n++) { if (by.has(n)) N = n; else if ([...by.keys()].filter(k => k > n).length === 0) break; }
  let have = 0; for (let n = 1; n <= N; n++) if (by.has(n)) have++; if (N < 3 || have < Math.max(3, N * 0.75)) return null;
  const all = [].concat(...[...by.values()]), mx = all.reduce((a, c) => a + c.x, 0) / all.length, my = all.reduce((a, c) => a + c.y, 0) / all.length, pts = [];
  for (let n = 1; n <= N; n++) { const C = by.get(n); if (!C) { pts.push({ n, x: null, y: null }); continue; } C.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)); pts.push({ n, x: C[0].x, y: C[0].y, r: C[0].r }); }
  return pts; }
/* the legend of a figure: lines that start with a callout number, on the same page or the next */
function legend(doc, p, next) { const out = {}; (next ? [p, p + 1] : [p]).forEach(q => { const pg = doc.pages[q - 1]; if (!pg) return;
    lines(pg, q).forEach(l => { const m = /^[(\[]?(\d{1,2})[)\].]?\s+(.+)$/.exec(l.text) || (l.segs.length > 1 && labelNum(l.segs[0].s) ? [0, labelNum(l.segs[0].s), l.segs.slice(1).map(x => x.s).join('   ')] : null);
      if (!m || out[+m[1]]) return; const segs = [{ x: 0, x2: 0, s: m[2] }], it = pair(l.segs.length > 1 && labelNum(l.segs[0].s) ? l.segs.slice(1) : segs) || pair(segs);
      const t = it ? (it.st ? it.n + ' – ' + it.st : it.n) : cleanName(m[2]); if (t && t.length <= 120 && /[A-Za-z]/.test(t) && words(t) <= 14) out[+m[1]] = { t, r: it && it.r || roleInTitle(m[2]) }; }); });
  return out; }
/* doc → figures: { page, box (page units), pts [{ n, x, y }], legend, src } */
function figures(doc) { const out = []; (doc.pages || []).forEach((pg, i) => { const p = i + 1, C = callouts(pg); if (C.length < 3) return; const W = pg.w || 600, H = pg.h || 800, used = new Set();
    // callouts inside a picture belong to that picture
    (pg.imgs || []).filter(B => B.w * B.h > W * H * 0.04).forEach(B => { const mine = C.filter(c => !used.has(c) && inBox(c.x, c.y, B, 3)), S = sequence(mine); if (!S) return; mine.forEach(c => used.add(c));
      out.push({ page: p, box: B, pts: S, src: mine.some(c => c.src === 'ocr') ? 'ocr' : 'text' }); });
    // callouts over a drawing (vector line art): the drawing's paths around them make the box
    const rest = C.filter(c => !used.has(c)), S = sequence(rest); if (!S) return;
    const xs = rest.map(c => c.x), ys = rest.map(c => c.y), col = xs.filter(x => Math.abs(x - xs[0]) < 4).length >= xs.length * 0.7; if (col) return; // a numbered column is a list, not a figure
    let U = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const E = { x: U.x - W * 0.08, y: U.y - H * 0.06, w: U.w + W * 0.16, h: U.h + H * 0.12 };
    (pg.paths || []).forEach(P => { if (P.w * P.h < W * H * 0.6 && P.w < W * 0.95 && inBox(P.x + P.w / 2, P.y + P.h / 2, E, 0)) U = union(U, P); });
    const pad = Math.max(W, H) * 0.015, x0 = Math.max(0, U.x - pad), y0 = Math.max(0, U.y - pad); U = { x: x0, y: y0, w: Math.min(W, U.x + U.w + pad) - x0, h: Math.min(H, U.y + U.h + pad) - y0 };
    out.push({ page: p, box: U, pts: S, src: 'text' }); });
  const fp = new Set(out.map(f => f.page)); out.forEach(f => { f.legend = legend(doc, f.page, !fp.has(f.page + 1)); }); return out; }
/* text flows + figures → one list: a flow written next to its figure gets the figure (its steps go onto the callouts in order);
   a figure with no flow beside it becomes a flow of its own, named from its legend or numbered */
function link(flows, figs, doc, opt) { opt = opt || {}; const out = flows.slice(); let L = [];
  (doc.pages || []).forEach((pg, i) => { L = L.concat(lines(pg, i + 1)); }); L = dropRunning(L, (doc.pages || []).length);
  const figPages = new Set(figs.map(g => g.page)), fits = (f, N) => { const a = f.steps.filter(s => s.k === 'act').length; return a >= N * 0.6 && a <= N * 1.5; };
  const pick = new Map(); figs.forEach(g => { const f = out.find(f => !f.fig && ![...pick.values()].includes(f) && f.page === g.page && fits(f, g.pts.length)); if (f) pick.set(g, f); }); // same page first
  figs.forEach(g => { if (pick.has(g)) return; const f = out.filter(f => !f.fig && ![...pick.values()].includes(f) && Math.abs(f.page - g.page) === 1 && !figPages.has(f.page) && fits(f, g.pts.length)).sort((a, b) => b.page - a.page)[0]; if (f) pick.set(g, f); });
  figs.forEach(g => { const N = g.pts.length, near = pick.get(g);
    const lg = g.legend || {}, nl = Object.keys(lg).length;
    if (near) { near.fig = g; const acts = near.steps.filter(s => s.k === 'act'); acts.forEach((s, i) => { s.n = i + 1; });
      if (nl >= N * 0.6) acts.forEach(s => { const k = Object.keys(lg).find(n => norm(lg[n].t) === norm(s.t)); if (k) s.n = +k; }); return; }
    // the title: the closest heading above the figure on its page, else the page's first heading
    const above = L.filter(l => l.p === g.page && l.y < g.box.y + 4 && heading(l, 9)).pop() || L.filter(l => l.p === g.page && heading(l, 9))[0];
    const name = cleanTitle(above ? above.text.replace(/\s{2,}/g, ' ') : '') || ('Figure, page ' + g.page);
    const steps = g.pts.map(pt => { const e = lg[pt.n]; return { r: e && e.r && e.r !== '*' ? e.r : null, t: e ? e.t : 'Step ' + pt.n, k: e && /\bchecklist\b/i.test(e.t) ? 'call' : 'act', n: pt.n, named: !!e }; });
    const used = new Set(steps.map(s => s.r).filter(Boolean)), rs = [...used].some(r => /^CM/.test(r)) ? 'cm' : used.size ? 'pfpm' : (opt.crew === 1 ? 'one' : 'pfpm'), roles = { pfpm: ['PF', 'PM'], cm: ['CM1', 'CM2'], one: ['P'] }[rs];
    steps.forEach(s => { s.r = rs === 'one' ? 'P' : roles.includes(s.r) ? s.r : roles[0]; });
    out.push({ name: name.slice(0, 80), phase: phaseOf(name), rs, roles, steps, page: g.page, fig: g, unnamed: steps.filter(s => !s.named).length }); });
  return out.sort((a, b) => a.page - b.page); }
/* a step's spot on the figure, in the flow's own coordinates (the picture is 1000 wide) */
function figSpot(g, n) { const pt = g.pts.find(x => x.n === n); if (!pt || pt.x == null) return null; return { x: Math.round((pt.x - g.box.x) / g.box.w * 1000), y: Math.round((pt.y - g.box.y) / g.box.w * 1000) }; }

/* ---------- reading the PDF (browser) ---------- */
/* text of every page, plus where pictures and drawings sit (to find figures); the pdf stays open for rendering figures */
async function lib() { const L = await import('./vendor/pdfjs/pdf.min.mjs?v=4.10.38'); L.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.mjs?v=4.10.38'; return L; }
function boxes(ops, OPS, vt) { const imgs = [], paths = []; let m = [1, 0, 0, 1, 0, 0]; const st = [];
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const box = (M, x0, y0, x1, y1) => { const T = mul(vt, M), P = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]]);
    const xs = P.map(q => q[0]), ys = P.map(q => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  for (let i = 0; i < ops.fnArray.length; i++) { const f = ops.fnArray[i], a = ops.argsArray[i];
    if (f === OPS.save) st.push(m); else if (f === OPS.restore) m = st.pop() || [1, 0, 0, 1, 0, 0]; else if (f === OPS.transform) m = mul(m, a);
    else if (f === OPS.paintFormXObjectBegin) { st.push(m); if (a && a[0]) m = mul(m, a[0]); } else if (f === OPS.paintFormXObjectEnd) m = st.pop() || m;
    else if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject || f === OPS.paintImageMaskXObject || f === OPS.paintImageXObjectRepeat) imgs.push(box(m, 0, 0, 1, 1));
    else if (f === OPS.constructPath && a && a[2] && a[2].length >= 4 && paths.length < 4000) { const b = box(m, a[2][0], a[2][1], a[2][2], a[2][3]); if (b.w > 1 || b.h > 1) paths.push(b); } }
  // overlapping picture tiles (a cockpit photo in strips) are one picture
  const big = []; imgs.filter(b => b.w > 20 && b.h > 20).forEach(b => { const o = big.find(c => inBox(b.x + b.w / 2, b.y + b.h / 2, { x: c.x - 4, y: c.y - 4, w: c.w + 8, h: c.h + 8 }, 0) || (b.x <= c.x + c.w + 4 && c.x <= b.x + b.w + 4 && b.y <= c.y + c.h + 4 && c.y <= b.y + b.h + 4));
    if (o) Object.assign(o, union(o, b)); else big.push(Object.assign({}, b)); });
  return { imgs: big, paths }; }
async function read(file, progress) { const L = await lib();
  const pdf = await L.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise, pages = []; let chars = 0;
  for (let n = 1; n <= pdf.numPages; n++) { const pg = await pdf.getPage(n), v = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent(), items = [];
    tc.items.forEach(i => { if (!i.str || !i.str.trim()) return; const tr = i.transform, h = Math.abs(i.height || Math.hypot(tr[2], tr[3])) || 8;
      if (Math.abs(tr[1]) > Math.abs(tr[0]) * 0.3) return; // rotated text (margins, stamps)
      const p = v.convertToViewportPoint(tr[4], tr[5]); items.push({ s: i.str, x: p[0], y: p[1] - h * 0.8, w: Math.abs(i.width) || i.str.length * h * 0.5, h }); chars += i.str.length; });
    let bx = { imgs: [], paths: [] }; try { bx = boxes(await pg.getOperatorList(), L.OPS, v.transform); } catch (e) {}
    pages.push({ w: v.width, h: v.height, items, imgs: bx.imgs, paths: bx.paths }); pg.cleanup(); if (progress) progress(n, pdf.numPages); }
  return { pages, chars, name: file.name || 'manual.pdf', pdf }; }
/* a figure as a picture: the page drawn sharp and cut to the figure */
async function render(doc, p, B, maxPx) { const pg = await doc.pdf.getPage(p), s = Math.min(4, (maxPx || 2000) / Math.max(B.w, B.h)), v = pg.getViewport({ scale: s }), c = document.createElement('canvas');
  c.width = Math.round(B.w * s); c.height = Math.round(B.h * s); const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
  await pg.render({ canvasContext: cx, viewport: v, transform: [1, 0, 0, 1, -B.x * s, -B.y * s] }).promise; pg.cleanup(); return { canvas: c, s }; }
/* pictures whose numbers are part of the picture: read the digits on this device (tesseract.js, loaded only when needed) */
let TW = null;
async function ocrWorker() { if (TW) return TW; if (!G.Tesseract) await new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'vendor/tesseract/tesseract.min.js?v=5.1.1'; sc.onload = ok; sc.onerror = () => ko(new Error('OCR not available')); document.head.appendChild(sc); });
  const base = new URL('vendor/tesseract/', location.href).href;
  TW = await G.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: false, cacheMethod: 'none' });
  await TW.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '11' }); return TW; }
/* which pages to look at: a big picture, no callouts found in the text, and a flow-like word on the page or the one before */
function ocrPages(doc, figs, max) { const has = new Set(figs.map(f => f.page)), C = [];
  (doc.pages || []).forEach((pg, i) => { const p = i + 1; if (has.has(p)) return; const W = pg.w || 600, H = pg.h || 800, big = (pg.imgs || []).filter(B => B.w * B.h > W * H * 0.08); if (!big.length) return;
    const txt = pg.items.map(x => x.s).join(' ') + ' ' + ((doc.pages[i - 1] || { items: [] }).items.map(x => x.s).join(' ')), sc = (FLOWWORD.test(txt) ? 2 : 0) + (phaseOf(txt) ? 2 : 0) + (/\b(SCAN|PANEL|OVERHEAD|PEDESTAL|COCKPIT|FLIGHT DECK)\b/i.test(txt) ? 1 : 0);
    big.forEach(B => C.push({ p, B, sc })); });
  return C.sort((a, b) => b.sc - a.sc || a.p - b.p).slice(0, max || 60).sort((a, b) => a.p - b.p); }
/* round callout markers in a picture: a flat disc (any colour), about 1–7 % of the picture across, with something
   of another colour inside it (the number). Returns each marker with a clean black-on-white picture of what is inside. */
function discs(cv) { const W = cv.width, H = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, lab = new Int32Array(W * H), st = new Int32Array(W * H), out = [];
  const M = Math.max(W, H), dmin = Math.max(10, Math.round(M * 0.009)), dmax = Math.round(M * 0.07), T2 = 48 * 48; let id = 0;
  for (let i0 = 0; i0 < W * H; i0++) { if (lab[i0]) continue; id++; const r0 = d[4 * i0], g0 = d[4 * i0 + 1], b0 = d[4 * i0 + 2]; let sp = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; st[sp++] = i0; lab[i0] = id;
    while (sp) { const j = st[--sp], jx = j % W, jy = (j - jx) / W; n++; if (jx < x0) x0 = jx; if (jx > x1) x1 = jx; if (jy < y0) y0 = jy; if (jy > y1) y1 = jy;
      for (let q = 0; q < 4; q++) { const kx = q === 0 ? jx - 1 : q === 1 ? jx + 1 : jx, ky = q === 2 ? jy - 1 : q === 3 ? jy + 1 : jy; if (kx < 0 || ky < 0 || kx >= W || ky >= H) continue; const k = ky * W + kx; if (lab[k]) continue;
        const dr = d[4 * k] - r0, dg = d[4 * k + 1] - g0, db = d[4 * k + 2] - b0; if (dr * dr + dg * dg + db * db < T2) { lab[k] = id; st[sp++] = k; } } }
    const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < dmin || h < dmin || w > dmax || h > dmax || w / h < 0.78 || w / h > 1.28) continue;
    const fill = n / (w * h); if (fill < 0.42 || fill > 0.84) continue;
    // inside: pixels that are not the disc, within the inner part of the circle, must be there (the digit) and stand out
    const cx = x0 + w / 2, cy = y0 + h / 2, R = Math.min(w, h) / 2; let hole = 0, inner = 0, con = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const e = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R); if (e > 0.5) continue; inner++; const k = y * W + x;
      if (lab[k] !== id) { hole++; con += Math.abs(d[4 * k] - r0) + Math.abs(d[4 * k + 1] - g0) + Math.abs(d[4 * k + 2] - b0); } }
    if (!inner || hole / inner < 0.05 || hole / inner > 0.55 || con / Math.max(1, hole) < 120) continue;
    const S = 96 / (2 * R), c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'), im = g.createImageData(120, 120);
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) { const sx = Math.round(cx + (x - 60) / S), sy = Math.round(cy + (y - 60) / S), e = ((sx - cx) ** 2 + (sy - cy) ** 2) / (R * R), k = sy * W + sx, o = 4 * (y * 120 + x);
      const ink = e <= 0.8 && sx >= 0 && sy >= 0 && sx < W && sy < H && lab[k] !== id && (Math.abs(d[4 * k] - r0) + Math.abs(d[4 * k + 1] - g0) + Math.abs(d[4 * k + 2] - b0)) > 90; /* the inside of a 6, 8, 9 or 0 has the disc's colour */ im.data[o] = im.data[o + 1] = im.data[o + 2] = ink ? 0 : 255; im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0); out.push({ x: cx, y: cy, r: R, c, col: [r0, g0, b0] }); if (out.length >= 160) break; }
  return out; }
/* the number in a marker: only markers whose ink looks like one or two digits (not a dial or a knob), each read on its own */
function glyph(c) { const g = c.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, 120, 120).data; let x0 = 120, x1 = -1, y0 = 120, y1 = -1, n = 0;
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) if (!d[4 * (y * 120 + x)]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null; const w = x1 - x0 + 1, h = y1 - y0 + 1, f = n / (w * h);
  if (h < 96 * 0.28 || h > 96 * 0.8 || w / h < 0.2 || w / h > 1.7 || f < 0.12 || f > 0.75 || x0 < 14 || x1 > 105 || y0 < 14 || y1 > 105) return null; // ink touching the ring is not a number
  const k = 64 / h, o = document.createElement('canvas'); o.width = Math.round(w * k) + 48; o.height = 112; const q = o.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, o.width, o.height);
  q.imageSmoothingEnabled = true; q.drawImage(c, x0, y0, w, h, 24, 24, w * k, 64); return o; }
async function readDiscs(w, D) { const out = [];
  for (const o of D) { const gl = glyph(o.c); if (!gl) continue; let best = null;
    for (const psm of ['10', '8', '13']) { await w.setParameters({ tessedit_pageseg_mode: psm }); const r = await w.recognize(gl), t = (r.data.text || '').replace(/\s+/g, '');
      if (/^\d{1,2}$/.test(t) && r.data.confidence >= 45) { best = +t; break; } }
    if (best) out.push(Object.assign({}, o, { n: best })); }
  return out; }
async function ocr(doc, figs, progress, stop) { const C = ocrPages(doc, figs); if (!C.length) return 0; const w = await ocrWorker(); let n = 0;
  for (let i = 0; i < C.length; i++) { if (stop && stop()) break; const { p, B } = C[i]; if (progress) progress(i + 1, C.length);
    const { canvas, s } = await render(doc, p, B, 1400), D = discs(canvas), R0 = await readDiscs(w, D), pg = doc.pages[p - 1];
    // a figure's callouts look alike (same size and colour): keep the largest family, so a stray digit on a panel does not count
    const like = (a, b) => Math.abs(a.r - b.r) < 0.25 * Math.max(a.r, b.r) && Math.abs(a.col[0] - b.col[0]) + Math.abs(a.col[1] - b.col[1]) + Math.abs(a.col[2] - b.col[2]) < 90;
    let R = []; R0.forEach(a => { const fam = R0.filter(b => like(a, b)); if (fam.length > R.length) R = fam; });
    R.forEach(o => { const hh = 2 * o.r / s; pg.items.push({ s: String(o.n), x: B.x + (o.x - o.r) / s, y: B.y + (o.y - o.r) / s, w: hh, h: hh, ocr: true }); n++; }); }
  return n; }
/* the manual's own numbers would give the answer away when practising: each callout is covered with the colour around it */
function hide(cv, s, B, pts) { const g = cv.getContext('2d'), W = cv.width, H = cv.height, all = g.getImageData(0, 0, W, H).data;
  pts.forEach(pt => { if (pt.x == null) return; const cx = (pt.x - B.x) * s, cy = (pt.y - B.y) * s, R = Math.max(6, (pt.r || 6) * s * 1.35); const px = [];
    for (let a = 0; a < 24; a++) { const x = Math.round(cx + Math.cos(a / 24 * 2 * Math.PI) * R * 1.25), y = Math.round(cy + Math.sin(a / 24 * 2 * Math.PI) * R * 1.25); if (x < 0 || y < 0 || x >= W || y >= H) continue; const o = 4 * (y * W + x); px.push([all[o], all[o + 1], all[o + 2]]); }
    if (!px.length) return; const med = k => px.map(q => q[k]).sort((a, b) => a - b)[px.length >> 1], col = `rgb(${med(0)},${med(1)},${med(2)})`;
    const gr = g.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.15); gr.addColorStop(0, col); gr.addColorStop(1, col.replace('rgb', 'rgba').replace(')', ',0)'));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.15, 0, 2 * Math.PI); g.fill(); }); }

const API = { read, find, place, match, guessAc, norm, phaseOf, lines, items, roleHead, figures, link, figSpot, callouts, render, ocr, ocrPages, boxes, hide, discs, glyph };
if (typeof module === 'object' && module.exports) module.exports = API; else G.BBFLOWPDF = API;
})(typeof window !== 'undefined' ? window : globalThis);
