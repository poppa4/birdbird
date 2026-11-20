/* NORDAP – forecast outlook in the browser: understands "ENTO mandag kl 10" / "ENGM tomorrow 14z", asks /api/outlook, and writes
   the answer in plain words. Used by the search bar (search.js, a short row) and by outlook.html (the full analysis).
   OUT.parseWhen(text, now, tz)  → { ms (UTC, whole hour), z, day, time } or null
   OUT.query(text, isAerodrome, now, tzOf) → { icao|null, when } or null
   OUT.get(ap, icao, ms)         → Promise of the /api/outlook answer (cached per aerodrome and hour)
   OUT.words(cons, L, opts)      → { status, lines:[…], conf } in the page language
   Needs sun.js (SUN.tzOf) for the aerodrome's local time; without it, times are UTC. */
(function (G) {
'use strict';
const H = 36e5;
const pad = n => String(n).padStart(2, '0');

/* ---------- time zones ---------- */
function tzOffset(ms, tz) {
  if (!tz) return 0;
  try { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; } catch (e) { return 0; }
}
/* local wall time in tz → UTC ms */
function zoned(y, mo, d, h, mi, tz) { const g = Date.UTC(y, mo, d, h, mi); let u = g - tzOffset(g, tz); u = g - tzOffset(u, tz); return u; }
function localParts(ms, tz) { const d = new Date(ms + tzOffset(ms, tz)); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() }; }

/* ---------- "mandag kl 10", "tomorrow 14z", "23.11 0900", "om 3 timer" ---------- */
const WD = { søndag: 0, sondag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6, lordag: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, mai: 4, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
const DAYW = '(søndag|sondag|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|lordag|sunday|monday|tuesday|wednesday|thursday|friday|saturday|i\\s*dag|idag|today|i\\s*overmorgen|overmorgen|i\\s*morgen|imorgen|i\\s*morra|imorra|tomorrow)';
function parseWhen(text, now, tz) {
  const s = ' ' + String(text || '').toLowerCase().replace(/[?!,]/g, ' ').replace(/\s+/g, ' ') + ' ';
  now = now == null ? Date.now() : now; const L0 = localParts(now, tz);
  let m, rel = null;
  if ((m = s.match(/ (?:om|in) (\d{1,3}) ?(?:t|timer|time|h|hrs?|hours?) /)) || (m = s.match(/ \+(\d{1,3}) ?h /))) rel = +m[1];
  if (rel != null) { const ms = Math.round((now + rel * H) / H) * H; return { ms, z: false, day: true, time: true, rel }; }
  /* the day */
  let day = null, y = L0.y, mo = L0.mo, d = L0.d, wd = null;
  if (/ (i ?overmorgen|overmorgen|day after tomorrow) /.test(s)) day = 2;
  else if (/ (i ?morgen|imorgen|i ?morra|imorra|tomorrow|tmrw) /.test(s)) day = 1;
  else if (/ (i ?dag|idag|today) /.test(s)) day = 0;
  else { for (const k in WD) if (new RegExp(' ' + k + ' ').test(s)) { wd = WD[k]; break; } }
  let date = null;
  if ((m = s.match(/ (\d{4})-(\d{2})-(\d{2})/))) date = [+m[1], +m[2] - 1, +m[3]];
  else if ((m = s.match(/ (\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))? /)) && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12) date = [m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null, +m[2] - 1, +m[1]];
  else if ((m = s.match(/ (\d{1,2})\.? (jan|feb|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|des|dec)[a-z]* /))) date = [null, MON[m[2]], +m[1]];
  else if ((m = s.match(/ (jan|feb|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|des|dec)[a-z]* (\d{1,2}) /))) date = [null, MON[m[1]], +m[2]];
  /* the time */
  let h = null, mi = 0, z = false;
  const take = (hh, mm) => { hh = +hh; mm = +(mm || 0); if (hh > 23 || mm > 59) return false; h = hh; mi = mm; return true; };
  if ((m = s.match(/ (\d{1,2})(?::?(\d{2}))? ?(?:z|utc) /)) && take(m[1], m[2])) z = true;
  else if ((m = s.match(/ kl\.? ?(\d{1,2})(?:[:.](\d{2}))? /)) && take(m[1], m[2])) {}
  else if ((m = s.match(/ (\d{1,2})(?::(\d{2}))? ?(am|pm) /)) && +m[1] <= 12) { take((+m[1] % 12) + (m[3] === 'pm' ? 12 : 0), m[2]); }
  else if ((m = s.match(/ (?:at|klokka|klokken) (\d{1,2})(?::(\d{2}))? /)) && take(m[1], m[2])) {}
  else if ((m = s.match(/ (\d{1,2}):(\d{2}) /)) && take(m[1], m[2])) {}
  else if ((m = s.match(/ ([01]\d|2[0-3])([0-5]\d) /)) && !(date && date[0] && +(m[1] + m[2]) === date[0]) && take(m[1], m[2])) {}
  else if ((m = s.match(new RegExp(' ' + DAYW + ' (?:kl\\.? ?)?(\\d{1,2}) '))) && take(m[2])) {}
  if (h == null && (day != null || wd != null || date) && (m = s.match(/ (\d{1,2}) $/)) && !(date && +m[1] === date[2] && !s.match(/ \d{1,2} \d{1,2} $/))) take(m[1]);
  const hasDay = day != null || wd != null || date != null, hasTime = h != null;
  if (!hasDay && !hasTime) return null;
  if (date) { if (date[0]) y = date[0]; mo = date[1]; d = date[2]; }
  const hh = hasTime ? h : 12;
  let ms;
  if (z) { ms = Date.UTC(y, mo, d, hh, mi); }
  else ms = zoned(y, mo, d, hh, mi, tz);
  if (day != null) ms += day * 864e5;
  else if (wd != null && !date) { let add = (wd - L0.wd + 7) % 7; if (add === 0 && ms < now - H / 2) add = 7; ms += add * 864e5; if (!z) ms = (() => { const p = localParts(ms, tz); return zoned(p.y, p.mo, p.d, hh, mi, tz); })(); }
  else if (date && !date[0] && ms < now - 30 * 864e5) ms = z ? Date.UTC(y + 1, mo, d, hh, mi) : zoned(y + 1, mo, d, hh, mi, tz);
  else if (!hasDay && ms < now - H / 2) ms += 864e5; // a time that has passed today: tomorrow
  if (day != null && !z) { const p = localParts(ms, tz); ms = zoned(p.y, p.mo, p.d, hh, mi, tz); } // DST change between today and that day
  if (day === 0 && !hasTime && ms < now) ms = now + H; // "today" without a time, after noon: the next hour
  return { ms: Math.round(ms / H) * H, z, day: hasDay, time: hasTime };
}

/* aerodrome + time in one line; isAp(code) says whether a 4-letter word is a known aerodrome */
const WXWORD = /(vær|været|vaer|weather|forecast|prognose|outlook|værmelding|skybase|skydekke|skyer|clouds?|ceiling|wind|vind|metar|taf)/;
function query(text, isAp, now, tzOf) {
  const s = String(text || '').trim(); if (s.length < 6 || s.length > 160) return null;
  let icao = null;
  for (const w of s.split(/[\s,.?!:;()]+/)) { if (/^[A-Za-z]{2}[A-Za-z0-9]{2}$/.test(w) && isAp && isAp(w.toUpperCase())) { icao = w.toUpperCase(); break; } }
  const intent = WXWORD.test(s.toLowerCase());
  if (!icao && !intent) return null;
  const tz = icao && tzOf ? tzOf(icao) : null;
  const when = parseWhen(icao ? s.replace(new RegExp(icao, 'i'), ' ') : s, now, tz);
  if (!when) return null;
  return { icao, when, intent };
}

/* ---------- fetching ---------- */
const CACHE = {};
function get(ap, icao, ms) {
  const t = new Date(ms).toISOString().slice(0, 13) + ':00Z', k = icao + '|' + t;
  const c = CACHE[k]; if (c && (c.p || Date.now() - c.at < 10 * 60e3)) return c.p || Promise.resolve(c.v);
  const url = `/api/outlook?icao=${encodeURIComponent(icao)}&lat=${ap.lat}&lon=${ap.lon}&el=${ap.el == null ? 0 : ap.el}&t=${t}`;
  const p = fetch(url, { headers: { accept: 'application/json' } }).then(r => r.json()).then(j => { CACHE[k] = { v: j, at: Date.now() }; return j; })
    .catch(() => { delete CACHE[k]; return { ok: false, error: 'network' }; });
  CACHE[k] = { p }; p.then(() => { if (CACHE[k]) delete CACHE[k].p; });
  return p;
}

/* ---------- words ---------- */
const sp = n => n == null ? '—' : Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');
const AMT = { FEW: { en: 'a few clouds', no: 'litt skyer' }, SCT: { en: 'scattered cloud', no: 'spredte skyer' }, BKN: { en: 'broken cloud', no: 'brutt skydekke' }, OVC: { en: 'overcast', no: 'overskyet' } };
const AMTS = { FEW: 'FEW', SCT: 'SCT', BKN: 'BKN', OVC: 'OVC' };
function visTxt(v) { return v == null ? '—' : v >= 10000 ? '10 km+' : v >= 5000 ? Math.round(v / 1000) + ' km' : sp(v) + ' m'; }
function precipTxt(c, L) {
  if (!c.ptype) return null; const sh = /-sh$/.test(c.ptype), k = c.ptype.replace('-sh', ''), r = c.precip || 0;
  const int = r < 0.5 ? L({ en: 'light ', no: 'lett ' }) : r >= 4 ? L({ en: 'heavy ', no: 'kraftig ' }) : '';
  const nm = { rain: { en: 'rain', no: 'regn' }, snow: { en: 'snow', no: 'snø' }, sleet: { en: 'sleet', no: 'sludd' }, fzra: { en: 'freezing rain', no: 'underkjølt regn' } }[k];
  return int + L(nm) + (sh ? L({ en: ' showers', no: 'byger' }) : '');
}
const dirTxt = w => w && w.dir != null ? String(w.dir).padStart(3, '0') + '°' : '';
function windTxt(w, L) { if (!w || w.kt == null) return '—'; if (w.kt <= 2) return L({ en: 'calm', no: 'stille' }); return `${dirTxt(w)} ${w.kt} kt${w.gust ? L({ en: ', gusts ', no: ', kast ' }) + w.gust + ' kt' : ''}`; }
const STATUS = { vfr: { en: 'VFR', no: 'VFR' }, svfr: { en: 'Special VFR only', no: 'Kun spesiell VFR' }, ifr: { en: 'IFR only', no: 'Kun IFR' } };
function words(c, L, o) {
  o = o || {}; const lines = [];
  /* clouds */
  const ly = c.layers || [];
  if (!ly.length) lines.push(L({ en: 'No significant cloud below 20 000 ft.', no: 'Ingen vesentlige skyer under 20 000 ft.' }));
  else {
    const a = ly[0], first = L(AMT[a.amt] || AMT.SCT);
    let t = a.base <= 100 ? L({ en: `Cloud on the ground (fog or very low stratus), tops about ${sp(a.top)} ft`, no: `Sky helt ned (tåke eller svært lav stratus), toppene rundt ${sp(a.top)} ft` })
      : L({ en: `Cloud base about ${sp(a.base)} ft (${first}), tops about ${sp(a.top)} ft`, no: `Skybase rundt ${sp(a.base)} ft (${first}), toppene rundt ${sp(a.top)} ft` });
    if (c.ceil != null && c.ceil > a.base + 200) t += L({ en: `; ceiling about ${sp(c.ceil)} ft`, no: `; skydekke (ceiling) rundt ${sp(c.ceil)} ft` });
    if (c.ceil == null) t += L({ en: '; no ceiling', no: '; ingen ceiling' });
    const more = ly.slice(1, 3).map(l => `${AMTS[l.amt] || ''} ${sp(l.base)}–${sp(l.top)} ft`);
    if (more.length) t += L({ en: '. Above: ', no: '. Over: ' }) + more.join(', ');
    lines.push(t + '.');
  }
  /* visibility and weather */
  const pr = precipTxt(c, L);
  let v = L({ en: 'Visibility ', no: 'Sikt ' }) + visTxt(c.vis);
  if (pr) v += ', ' + pr; if (c.fog) v += L({ en: c.fog === 'likely' ? ', fog likely' : ', fog possible', no: c.fog === 'likely' ? ', tåke sannsynlig' : ', mulig tåke' });
  lines.push(v + '.');
  lines.push(L({ en: 'Wind ', no: 'Vind ' }) + windTxt(c.wind, L) + (c.w850 && c.w850.kt != null ? L({ en: ` · about 5 000 ft: ${dirTxt(c.w850)} ${c.w850.kt} kt`, no: ` · rundt 5 000 ft: ${dirTxt(c.w850)} ${c.w850.kt} kt` }) : '') + '.');
  /* freezing level and icing (altitudes, AMSL) */
  if (c.frz != null) { let f = c.frz <= (o.elevFt || 0) ? L({ en: 'Freezing level at the ground', no: 'Frysenivå ved bakken' }) : L({ en: `Freezing level about ${sp(c.frz)} ft`, no: `Frysenivå rundt ${sp(c.frz)} ft` });
    if (c.icing) f += L({ en: `; ${{ light: 'light', moderate: 'moderate', severe: 'severe' }[c.icing.sev]} icing likely in cloud from about ${sp(c.icing.from)} to ${sp(c.icing.to)} ft`, no: `; ${{ light: 'lett', moderate: 'moderat', severe: 'kraftig' }[c.icing.sev]} ising sannsynlig i sky fra rundt ${sp(c.icing.from)} til ${sp(c.icing.to)} ft` });
    lines.push(f + '.'); }
  if (c.cb) lines.push(L({ en: c.cb === 'likely' ? 'Thunderstorms/CB likely' : 'Showers with CB possible', no: c.cb === 'likely' ? 'Tordenvær/CB sannsynlig' : 'Byger med CB mulig' }) + (c.cape ? ` (CAPE ${sp(c.cape)} J/kg${c.thunder ? L({ en: ', thunder ', no: ', torden ' }) + Math.round(c.thunder) + ' %' : ''})` : '') + '.');
  if (c.turb) lines.push(L({ en: c.turb === 'moderate' ? 'Moderate turbulence likely below about 3 000 ft (gusty wind).' : 'Some turbulence near the ground (gusts).', no: c.turb === 'moderate' ? 'Moderat turbulens sannsynlig under rundt 3 000 ft (byig vind).' : 'Noe turbulens nær bakken (vindkast).' }));
  const status = L(STATUS[c.sera] || { en: '—', no: '—' });
  const conf = L({ low: { en: 'low', no: 'lav' }, medium: { en: 'medium', no: 'middels' }, high: { en: 'high', no: 'høy' } }[c.conf] || { en: '—', no: '—' });
  return { status, lines, conf };
}
const API = { STATUS, parseWhen, query, get, words, tzOffset, zoned, localParts, visTxt, windTxt, sp, AMT };
G.OUT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
