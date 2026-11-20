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
function cleanName(s) { return s.replace(BULLET, '').replace(/[\s.…:_·]+$/, '').replace(/\s+/g, ' ').trim(); }
function okName(n) { return n.length >= 2 && n.length <= 70 && /[A-Za-z]/.test(n) && words(n) <= 10 && !/[.!?]$/.test(n) && !/^(NOTE|CAUTION|WARNING|REMARK|REF|SEE|IF|WHEN|THE|THIS|IN|ON|AT)\b/i.test(n); }
function okState(st) { st = st.trim(); return st.length >= 1 && st.length <= 40 && words(st) <= 7 && (STATE.test(st) || upperish(st) || /^[\d.,\/°%\-+ ]+[A-Za-z%°]{0,6}$/.test(st)) && !/[.!?]$/.test(st.replace(/\.{2,}$/, '')); }
function pair(segs) { // segments of one item (left to right) → { n, st, r }
  segs = segs.slice(); let r = null;
  for (let i = segs.length - 1; i >= 0; i--) if (ROLE_RX.test(segs[i].s.trim())) { r = r || roleOf(segs[i].s); segs.splice(i, 1); }
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
    const its = items(l);
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

/* ---------- reading the PDF (browser) ---------- */
async function read(file, progress) { const lib = await import('./vendor/pdfjs/pdf.min.mjs?v=4.10.38'); lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.mjs?v=4.10.38';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise, pages = []; let chars = 0;
  for (let n = 1; n <= pdf.numPages; n++) { const pg = await pdf.getPage(n), v = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent(), items = [];
    tc.items.forEach(i => { if (!i.str || !i.str.trim()) return; const tr = i.transform, h = Math.abs(i.height || Math.hypot(tr[2], tr[3])) || 8;
      if (Math.abs(tr[1]) > Math.abs(tr[0]) * 0.3) return; // rotated text (margins, stamps)
      const p = v.convertToViewportPoint(tr[4], tr[5]); items.push({ s: i.str, x: p[0], y: p[1] - h * 0.8, w: Math.abs(i.width) || i.str.length * h * 0.5, h }); chars += i.str.length; });
    pages.push({ w: v.width, h: v.height, items }); pg.cleanup(); if (progress) progress(n, pdf.numPages); }
  pdf.destroy(); return { pages, chars, name: file.name || 'manual.pdf' }; }

const API = { read, find, place, match, guessAc, norm, phaseOf, lines, items, roleHead };
if (typeof module === 'object' && module.exports) module.exports = API; else G.BBFLOWPDF = API;
})(typeof window !== 'undefined' ? window : globalThis);
