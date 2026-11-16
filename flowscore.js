/* Birdbird – flow trainer core (flows.html): the flow model and everything that does not touch the page, so it runs in Node.
   A flow is a sequence of steps drawn over a cockpit: either one of Birdbird's own schematics (flowsac.js, named controls)
   or the user's own cockpit photo or PDF page (kept on the device). Steps belong to a role layer (PF/PM, CM1/CM2 or one pilot).
   Step kinds: 'act' (a control or spot), 'call' (a checklist or callout the role commands), 'event' (an outside start point:
   ATC clearance, fuel figures, cabin secure). A step can wait for a step of the other role ('after'). */
(function (G) {
'use strict';
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const ROLESETS = { pfpm: ['PF', 'PM'], cm: ['CM1', 'CM2'], one: ['P'] };
const COLORS = ['#3CCB7F', '#F2C230', '#4FA3FF', '#FF6B6B', '#C792EA', '#FFFFFF'];
function newFlow(ac, o) { o = o || {}; const rs = o.roles || (o.crew === 1 ? 'one' : 'pfpm');
  return { v: 1, id: uid(), name: o.name || 'New flow', ac: ac || 'img', img: o.img || null, roles: ROLESETS[rs] ? ROLESETS[rs].slice() : ['PF', 'PM'], rs,
    style: { col: { [ROLESETS[rs][0]]: COLORS[0], [(ROLESETS[rs][1] || 'X')]: COLORS[1] }, lw: 3, ls: 1 }, steps: [], notes: [], upd: Date.now() }; }
const roleSteps = (f, r) => f.steps.filter(s => s.r === r);
const placed = s => s.x != null && s.y != null;
function addStep(f, s) { const st = Object.assign({ id: uid(), r: f.roles[0], k: 'act', t: '' }, s); f.steps.push(st); f.upd = Date.now(); return st; }
function moveStep(f, id, d) { const i = f.steps.findIndex(s => s.id === id); if (i < 0) return; const r = f.steps[i].r;
  let j = i + d; while (j >= 0 && j < f.steps.length && f.steps[j].r !== r) j += d; if (j < 0 || j >= f.steps.length) return;
  const [s] = f.steps.splice(i, 1); f.steps.splice(j, 0, s); f.upd = Date.now(); }
function delStep(f, id) { f.steps = f.steps.filter(s => s.id !== id); f.steps.forEach(s => { if (s.after === id) delete s.after; }); f.upd = Date.now(); }
/* the badge on the cockpit: the step's own text if the user set one, else its number in its role */
function badge(f, s) { if (s.b) return String(s.b).slice(0, 6); return String(roleSteps(f, s.r).filter(x => x.k !== 'event').indexOf(s) + 1); }
/* SOP text pasted from a checklist or a company document → one step per line ("BATTERY....ON", "1. Fuel pumps – ON", "– Beacon ON").
   A line that names a checklist ("BEFORE START CHECKLIST", "… checklist") becomes a call. Headings ending in ':' are skipped. */
function parseSop(txt) { const out = [];
  String(txt || '').split(/\r?\n/).forEach(l => { let t = l.replace(/\t/g, ' ').trim(); if (!t || t.length < 2) return;
    t = t.replace(/^(\d{1,3}[.)]|[-–•*·▪►>]|\[\s?\]|☐)\s*/, '').replace(/\s*\.{3,}\s*|\s*…+\s*|\s{3,}/g, ' – ').trim();
    if (!t || /:$/.test(t) && t.length < 40) return;
    out.push({ t: t.slice(0, 120), k: /\bcheck\s?list\b|\bsjekkliste\b/i.test(t) ? 'call' : 'act' }); });
  return out.slice(0, 200); }
/* did a tap land on the step? On a schematic: inside the step's control (or within 18 units). On a photo: within the radius. */
function check(s, x, y, ac, A, pad) { if (!placed(s)) return { ok: false, d: Infinity }; pad = pad || 18;
  const d = Math.hypot(x - s.x, y - s.y);
  if (s.tg && ac && A) { const t = A.byId(ac, s.tg); if (t) { const P = pad; const ok = x >= t.x - P && x <= t.x + t.w + P && y >= t.y - P && y <= t.y + t.h + P; return { ok, d }; } }
  return { ok: d <= Math.max(s.rad || 45, pad * 1.6), d }; }
/* practise score: per role, first-try hits, total misses, time */
function score(log) { const by = {}; log.forEach(e => { const b = by[e.r] || (by[e.r] = { n: 0, first: 0, miss: 0, hints: 0 }); if (e.ok) { b.n++; if (!e.tries) b.first++; } else b.miss++; if (e.hint) b.hints++; }); return by; }
/* steps a role can do now in a live session: the next one in its layer, unless it waits for a partner step not done yet */
function nextFor(f, r, done) { const s = roleSteps(f, r).find(x => !done[x.id]); if (!s) return null; return { s, blocked: !!(s.after && !done[s.after]) }; }
/* clean a flow that came from a file, a link or the other pilot: only known fields, sane sizes */
function clean(o) { if (!o || typeof o !== 'object') return null; const f = newFlow(typeof o.ac === 'string' ? o.ac.slice(0, 12) : 'img', { roles: ROLESETS[o.rs] ? o.rs : 'pfpm' });
  f.id = typeof o.id === 'string' ? o.id.slice(0, 24) : f.id; f.name = String(o.name || 'Flow').slice(0, 80);
  if (Array.isArray(o.roles) && o.roles.length && o.roles.length <= 2) f.roles = o.roles.map(r => String(r).slice(0, 6));
  if (o.style && typeof o.style === 'object') { const c = {}; f.roles.forEach((r, i) => { const v = o.style.col && o.style.col[r]; c[r] = /^#[0-9a-f]{6}$/i.test(v || '') ? v : COLORS[i]; }); f.style = { col: c, lw: Math.min(8, Math.max(1, +o.style.lw || 3)), ls: Math.min(2, Math.max(0.6, +o.style.ls || 1)) }; }
  if (o.img && typeof o.img === 'object') f.img = { id: String(o.img.id || '').slice(0, 40), w: +o.img.w || 1000, h: +o.img.h || 1000, name: String(o.img.name || '').slice(0, 80) };
  const num = v => Number.isFinite(+v) ? Math.round(+v * 10) / 10 : null;
  f.steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 400).map(s => ({ id: String(s.id || uid()).slice(0, 24), r: f.roles.includes(s.r) ? s.r : f.roles[0], k: ['act', 'call', 'event'].includes(s.k) ? s.k : 'act',
    t: String(s.t || '').slice(0, 160), b: s.b ? String(s.b).slice(0, 6) : undefined, x: s.x == null ? null : num(s.x), y: s.y == null ? null : num(s.y), tg: s.tg ? String(s.tg).slice(0, 80) : undefined,
    after: s.after ? String(s.after).slice(0, 24) : undefined, n: s.n ? String(s.n).slice(0, 400) : undefined }));
  f.notes = (Array.isArray(o.notes) ? o.notes : []).slice(0, 60).map(n => ({ id: String(n.id || uid()).slice(0, 24), x: num(n.x), y: num(n.y), t: String(n.t || '').slice(0, 400) })).filter(n => n.x != null && n.y != null);
  f.upd = +o.upd || Date.now(); return f; }
/* share link: the flow (without the photo) as base64url JSON in the #hash */
const b64e = s => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'); };
function encode(f) { const o = JSON.parse(JSON.stringify(f)); if (o.img) o.img = { w: o.img.w, h: o.img.h, name: o.img.name, id: '' }; return b64e(JSON.stringify(o)); }
function decode(s) { try { return clean(JSON.parse(b64d(String(s)))); } catch (e) { return null; } }
/* example flow patterns for the schematics: where the eye and hand go, in what order. No switch positions: those come from
   your SOP (paste it in), because they differ between operators. */
const EX = {
  a320: { name: 'Example: cockpit scan pattern', roles: 'pfpm', steps: [['PM', 'ELEC|BAT 1', 'Battery and external power'], ['PM', 'ADIRS|IR MODE 1', 'ADIRS'], ['PM', 'EMER ELEC PWR|GEN 1 LINE', 'Overhead left column, top to bottom'], ['PM', 'FIRE|ENG 1 FIRE', 'Overhead centre: fire'], ['PM', 'FUEL|MODE SEL', 'Fuel'], ['PM', 'AIR COND|APU BLEED', 'Air conditioning'], ['PM', 'EXT LT|BEACON', 'Lights'], ['PM', 'SIGNS|SEAT BELTS', 'Signs'], ['PM', 'FLT CTL 2|ELAC 2', 'Overhead right column'], ['PF', 'FCU|SPD', 'FCU and EFIS'], ['PF', 'PFD CPT', 'PFD / ND'], ['PF', 'MCDU 1', 'FMGS'], ['PF', 'LDG GEAR / BRAKES|AUTO BRK MAX', 'Brakes'], ['PF', 'THRUST LEVERS|THR LVR 1', 'Pedestal'], ['PF', null, 'Before start checklist', 'call']] },
  b738: { name: 'Example: preliminary preflight scan pattern', roles: 'pfpm', steps: [['PM', 'ELEC|BAT', 'Battery and standby power'], ['PM', 'FLT CONTROL|FLT CONTROL A', 'Flight controls'], ['PM', 'FUEL|FWD PUMP 1', 'Fuel'], ['PM', 'ELEC|GEN 1', 'Electrics'], ['PM', 'APU|APU SWITCH', 'APU'], ['PM', 'WINDOW / PROBE HEAT|WINDOW HEAT L SIDE', 'Window and probe heat'], ['PM', 'HYDRAULICS|ENG 1 HYD', 'Hydraulics'], ['PM', 'BLEED|APU BLEED', 'Bleed air and packs'], ['PM', 'PRESSURIZATION|PRESS MODE SEL', 'Pressurisation'], ['PM', 'EXT LIGHTS|POSITION', 'Lights'], ['PF', 'MCP|COURSE CPT', 'Mode control panel'], ['PF', 'EFIS CPT|BARO CPT', 'EFIS'], ['PF', 'PFD CPT', 'PFD / ND'], ['PF', 'CDU L', 'FMC'], ['PF', 'GEAR / AUTOBRAKE|AUTOBRAKE', 'Autobrake'], ['PF', 'FIRE PROTECTION|OVHT/FIRE TEST', 'Fire test'], ['PF', 'THRUST LEVERS|THR LEVER 1', 'Pedestal'], ['PF', null, 'Before start checklist', 'call']] },
  atr72: { name: 'Example: preliminary cockpit preparation pattern', roles: 'pfpm', steps: [['PM', 'MAIN ELEC PWR|BAT', 'Battery and external power'], ['PM', 'ENG 1 FIRE|ENG 1 FIRE HANDLE', 'Fire protection'], ['PM', 'ENG START|START SEL', 'Engine start and EEC'], ['PM', 'ANTI / DE ICING|MODE SEL', 'Anti-icing'], ['PM', 'FUEL|FUEL PUMP 1', 'Fuel'], ['PM', 'HYD PWR|AUX PUMP', 'Hydraulics'], ['PM', 'AIR BLEED|BLEED 1', 'Air bleed'], ['PM', 'EXT LT / SIGNS|BEACON', 'Lights'], ['PM', 'EXT LT / SIGNS|SEAT BELTS', 'Signs'], ['PF', 'FGCP (AFCS)|HDG', 'Flight guidance'], ['PF', 'PFD CPT', 'PFD / ND'], ['PF', 'MCDU 1', 'FMS'], ['PF', 'TRIM|PITCH TRIM', 'Trims'], ['PF', 'CONDITION LEVERS|CL 1', 'Condition levers'], ['PF', 'PARKING / EMER BRAKE|PARKING BRAKE', 'Parking brake'], ['PF', null, 'Before start checklist', 'call']] },
  'ph-a320ovh': { name: 'Example: overhead scan on the real A320 panel', roles: 'one', steps: [['P', [203, 94], 'EVAC – CAPT & PURS'], ['P', [110, 173], 'EMER ELEC PWR – check'], ['P', [145, 248], 'GPWS – all lights out'], ['P', [122, 302], 'RCDR – GND CTL'], ['P', [226, 362], 'OXYGEN – CREW SUPPLY ON'], ['P', [214, 478], 'WIPER – OFF'], ['P', [474, 82], 'BAT 1 and BAT 2 – check, AUTO'], ['P', [551, 178], 'EXT PWR – as required'], ['P', [303, 305], 'PACK 1'], ['P', [493, 345], 'BLEED – ENG 1, APU, ENG 2'], ['P', [565, 350], 'X BLEED – AUTO'], ['P', [687, 302], 'PACK 2'], ['P', [392, 415], 'ANTI ICE – OFF'], ['P', [493, 415], 'PROBE/WINDOW HEAT – AUTO'], ['P', [640, 420], 'CABIN PRESS – LDG ELEV AUTO'], ['P', [438, 475], 'EXT LT – NAV & LOGO'], ['P', [543, 523], 'SIGNS – SEAT BELTS'], ['P', [660, 528], 'EMER EXIT LT – ARM'], ['P', [860, 103], 'FLT CTL – all lights out'], ['P', [843, 295], 'CARGO SMOKE – check'], ['P', [790, 350], 'VENTILATION – AUTO'], ['P', [785, 415], 'ENG MAN START – OFF'], ['P', null, 'Overhead scan complete', 'call']] },
  'ph-atr72ovh': { name: 'Example: overhead scan on the real ATR 72 panel', roles: 'one', steps: [['P', [75, 305], 'ENG 1 FIRE handle – in, lights out'], ['P', [395, 280], 'CVR – TEST'], ['P', [650, 312], 'EMER LOC XMTR – AUTO'], ['P', [910, 305], 'ENG 2 FIRE handle – in, lights out'], ['P', [135, 512], 'FLT CTL – MFC lights out'], ['P', [61, 729], 'FUEL – LP VALVE 1'], ['P', [71, 800], 'FUEL PUMP 1'], ['P', [142, 750], 'X FEED – off'], ['P', [232, 797], 'FUEL PUMP 2'], ['P', [413, 500], 'BAT – ON'], ['P', [293, 714], 'DC GEN 1'], ['P', [408, 713], 'DC EXT PWR – as required'], ['P', [449, 715], 'DC GEN 2'], ['P', [300, 775], 'START 1'], ['P', [380, 822], 'ENG START selector'], ['P', [446, 775], 'START 2'], ['P', [380, 875], 'PROP BRAKE'], ['P', [535, 412], 'HYD – BLUE PUMP'], ['P', [592, 412], 'HYD – AUX PUMP'], ['P', [703, 412], 'HYD – GREEN PUMP'], ['P', [532, 570], 'ACW GEN 1'], ['P', [692, 570], 'ACW GEN 2'], ['P', [568, 707], 'PROBES HTG'], ['P', [681, 657], 'WINDSHIELD HTG'], ['P', [600, 822], 'ANTI ICING – MODE SEL'], ['P', [840, 532], 'OXYGEN – MAIN SUPPLY'], ['P', [771, 768], 'COMPT TEMP – FLT COMPT'], ['P', [895, 770], 'COMPT TEMP – CABIN'], ['P', [772, 870], 'AIR BLEED – ENG 1 BLEED'], ['P', [865, 875], 'AIR BLEED – ENG 2 BLEED'], ['P', [564, 936], 'SIGNS – SEAT BELTS'], ['P', null, 'Overhead scan complete', 'call']] },
  b200: { name: 'Example: before-start scan pattern', roles: 'pfpm', steps: [['PF', 'PILOT LEFT SUBPANEL|BATTERY', 'Left subpanel'], ['PF', 'FUEL PANEL (L SIDEWALL)|FUEL QTY', 'Fuel panel'], ['PF', 'FIRE L / WARNING|FIRE PULL L', 'Fire and warning'], ['PF', 'ANNUNCIATOR PANEL', 'Annunciators'], ['PF', 'POWER LEVERS|POWER LEVER L', 'Pedestal'], ['PM', 'COPILOT RIGHT SUBPANEL|BLEED AIR L', 'Right subpanel'], ['PM', 'COPILOT INSTRUMENTS|ALTIMETER F/O', 'Instruments'], ['PF', null, 'Before start checklist', 'call']] },
  pa34: { name: 'Example: panel scan pattern', roles: 'one', steps: [['P', 'PARKING BRAKE|PARKING BRAKE', 'Brakes'], ['P', 'SWITCH PANEL|BATTERY MASTER', 'Switch panel, left to right'], ['P', 'FLIGHT INSTRUMENTS|ATTITUDE', 'Flight instruments'], ['P', 'AVIONICS STACK|AUDIO PANEL', 'Avionics, top to bottom'], ['P', 'ENGINE INSTRUMENTS|FUEL QTY', 'Engine instruments'], ['P', 'COWL FLAPS|COWL FLAP L', 'Cowl flaps'], ['P', 'THROTTLE QUADRANT|THROTTLES', 'Quadrant'], ['P', 'FUEL SELECTOR L|FUEL SEL L (ON/OFF/X-FEED)', 'Fuel selectors'], ['P', null, 'Before start checklist', 'call']] },
  da42: { name: 'Example: panel scan pattern', roles: 'one', steps: [['P', 'PEDESTAL|PARKING BRAKE', 'Brakes'], ['P', 'FUEL SELECTORS|FUEL SELECTOR L', 'Fuel selectors'], ['P', 'POWER LEVERS|POWER LEVER L', 'Power levers'], ['P', 'ENGINE / ELECTRIC|ELECTRIC MASTER', 'Switch panel'], ['P', 'PFD|PFD', 'PFD'], ['P', 'MFD|MFD', 'MFD and engine page'], ['P', 'FLAPS|FLAPS', 'Right panel'], ['P', null, 'Before start checklist', 'call']] },
  c172: { name: 'Example: panel scan pattern', roles: 'one', steps: [['P', 'FUEL SELECTOR|FUEL SELECTOR', 'Fuel selector'], ['P', 'SWITCHES|MASTER BAT', 'Switches'], ['P', 'FLIGHT INSTRUMENTS|ALTIMETER', 'Flight instruments'], ['P', 'AUDIO PANEL|AUDIO PANEL', 'Radios'], ['P', 'ENGINE CONTROLS|MIXTURE', 'Engine controls'], ['P', 'FLAPS|WING FLAPS', 'Flaps'], ['P', null, 'Before start checklist', 'call']] } };
function example(acId, A) { const e = EX[acId], ac = A && A.get(acId), ph = A && A.photo && A.photo(acId); if (!e || (!ac && !ph)) return null; const f = newFlow(acId, { roles: e.roles, name: e.name }); f.ex = true;
  e.steps.forEach(([r, tg, t, k]) => { if (Array.isArray(tg)) { addStep(f, { r, t, k: k || 'act', x: tg[0], y: tg[1] }); return; } const T = tg && ac && A.byId(ac, tg); addStep(f, { r, t, k: k || 'act', tg: T ? T.id : undefined, x: T ? Math.round(T.x + T.w / 2) : null, y: T ? Math.round(T.y + T.h / 2) : null }); });
  return f; }
const API = { uid, ROLESETS, COLORS, newFlow, roleSteps, placed, addStep, moveStep, delStep, badge, parseSop, check, score, nextFor, clean, encode, decode, example };
if (typeof module === 'object' && module.exports) module.exports = API; else G.BBFLOW = API;
})(typeof window !== 'undefined' ? window : globalThis);
