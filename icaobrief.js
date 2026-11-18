/* NORDAP – "now at the aerodrome" in the search bar, for an ICAO code (loaded by search.js the first time one is typed).
   Four lines, each from data the site already serves, worked out here:
     1. SERA status from the current METAR, the EASA way only: the SERA minima met or not, VFR in a control zone (visibility
        ≥ 5 km and ceiling ≥ 1500 ft, SERA.5005), else special VFR (1500 m / 600 ft, SERA.5010), else neither. No other categories. A planning aid, not a decision: ATC, the ATIS and the rules decide.
     2. SIGMETs in force over the aerodrome (/api/sigmet: MET Norway in Norway, aviationweather.gov elsewhere): the ones whose
        area contains the aerodrome, or that cover its FIR when no area is given.
     3. Freezing level over the aerodrome from the GFS forecast (/api/clouds, NOAA, public domain).
     4. A small radar picture of the last 15 minutes around the aerodrome (/api/radar, EUMETNET OPERA, CC BY 4.0), drawn by
        radarworker.js over the coastline (Natural Earth, public domain).
   ICB.ensure(icao, ap, redraw) fetches what is missing (each source cached for a few minutes) and calls redraw when
   something arrives; ICB.html(icao, metar, L) returns the row. ICB.status(metar) is exported for the tests. */
(function (G) {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = {}; // icao → { sig, sigAt, frz, frzAt, rad, radAt, busy:{} }

/* ---------- 1. SERA status from a METAR ---------- */
function parseMetar(raw) {
  if (!raw) return null;
  let s = ' ' + String(raw).toUpperCase().replace(/=\s*$/, '') + ' ';
  s = s.split(/ (?:TEMPO|BECMG|NOSIG|RMK|FM\d{6}) /)[0] + ' ';
  const out = { vis: null, ceil: null, cavok: / CAVOK /.test(s), rvr: [] };
  /* RVR groups R18/0450, R01L/M0050, R36/P2000, R18/0450V0600FT/U: the lower value, in metres; M = less than, P = more than */
  for (const m of s.matchAll(/ R(\d{2}[LCR]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?(?:\/?[UDN])?(?= )/g)) {
    const k = m[6] ? 0.3048 : 1; out.rvr.push({ rwy: m[1], m: Math.round(+m[3] * k), less: m[2] === 'M', more: m[2] === 'P' }); }
  if (/\bSM\b/.test(s)) return null; // statute miles: not a European report, not judged
  if (out.cavok) { out.vis = 10000; out.ceil = Infinity; return out; }
  const toks = s.trim().split(/\s+/); let windSeen = false;
  for (const t of toks) {
    if (/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(t)) { windSeen = true; continue; }
    if (windSeen && out.vis == null && /^\d{4}(NDV)?$/.test(t)) { out.vis = +t.slice(0, 4) === 9999 ? 10000 : +t.slice(0, 4); continue; }
    const m = /^(BKN|OVC|VV)(\d{3}|\/\/\/)/.exec(t);
    if (m && m[2] !== '///') { const h = +m[2] * 100; if (out.ceil == null || h < out.ceil) out.ceil = h; }
  }
  if (out.ceil == null) out.ceil = Infinity; // no BKN/OVC/VV: no ceiling
  return out.vis == null ? null : out;
}
function status(raw) {
  const p = parseMetar(raw); if (!p) return null;
  const ok = p.vis >= 5000 && p.ceil >= 1500, svfr = p.vis >= 1500 && p.ceil >= 600;
  return { cls: ok ? 'ok' : 'no', vis: p.vis, ceil: p.ceil, svfr: !ok && svfr, cavok: p.cavok };
}
const fmtVis = v => v >= 10000 ? '10 km+' : v >= 5000 ? Math.round(v / 1000) + ' km' : v + ' m';
const fmtCeil = c => c === Infinity ? null : c + ' ft';

/* ---------- 2. SIGMETs over the aerodrome ---------- */
function inPoly(lon, lat, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
const lev = v => v == null ? null : v <= 0 ? 'SFC' : v >= 5000 ? 'FL' + String(Math.round(v / 100)).padStart(3, '0') : v + ' ft';
async function getSig(icao, ap) {
  const j = await (await fetch('/api/sigmet?fir=' + icao.slice(0, 2), { headers: { accept: 'application/json' } })).json();
  if (!j || !j.ok) throw new Error('sigmet');
  const now = Date.now();
  return (j.items || []).filter(x => (!x.from || Date.parse(x.from) <= now + 60e3) && (!x.to || Date.parse(x.to) >= now))
    .filter(x => x.poly && x.poly.length > 2 ? inPoly(ap.lon, ap.lat, x.poly) : true)
    .map(x => ({ type: x.type, label: x.label, base: lev(x.base), top: lev(x.top), to: x.to, area: !!(x.poly && x.poly.length > 2), fir: x.firName || x.fir }));
}

/* ---------- 3. freezing level ---------- */
async function getFrz(ap) {
  const la = Math.floor(ap.lat / 5) * 5, lo = Math.floor(ap.lon / 5) * 5;
  const j = await (await fetch(`/api/clouds?tile=${la},${lo}`, { headers: { accept: 'application/json' } })).json();
  if (!j || !j.ok || !j.frz) throw new Error('clouds');
  const i = Math.round((j.la0 - ap.lat) / j.d), k = Math.round((ap.lon - j.lo0) / j.d);
  const row = j.frz[Math.max(0, Math.min(j.frz.length - 1, i))]; const v = row && row[Math.max(0, Math.min(row.length - 1, k))];
  if (v == null || !isFinite(v)) throw new Error('frz');
  return { ft: Math.round(v / 100) * 100, valid: j.valid || null };
}

/* ---------- 4. radar picture ---------- */
let coastP = null, wk = null, radP = null;
const loadCoast = () => coastP || (coastP = fetch('data/map-eu.json').then(r => r.json()).then(d => (d.coast || []).map(a => { const p = []; for (let i = 0; i < a.length; i += 2) p.push([a[i] / 100, a[i + 1] / 100]); return p; })));
const D = Math.PI / 180, my = la => Math.log(Math.tan(Math.PI / 4 + la * D / 2));
/* newest composite, once per page per 10 minutes for all aerodromes */
let radBuf = null, radT = null, radAt = 0;
async function radarFile() {
  if (radBuf && Date.now() - radAt < 10 * 60e3) return { buf: radBuf, t: radT };
  if (!radP) radP = (async () => { const j = await (await fetch('/api/radar', { headers: { accept: 'application/json' } })).json(); if (!j || !j.ok) throw new Error('radar');
    const buf = await (await fetch(j.url)).arrayBuffer(); radBuf = buf; radT = j.t; radAt = Date.now(); return { buf, t: j.t }; })().finally(() => { radP = null; });
  return radP;
}
async function getRadar(ap) {
  const W = 300, H = 180, dLat = 1.2, dLon = (W / H) * (my(ap.lat + dLat) - my(ap.lat - dLat)) / (2 * D); // same shape in Web Mercator as the picture
  const b = [ap.lon - dLon, ap.lat - dLat, ap.lon + dLon, ap.lat + dLat];
  const [{ buf, t }, coast] = await Promise.all([radarFile(), loadCoast()]);
  if (!wk) wk = new Worker('radarworker.js?v=2');
  const copy = buf.slice(0); // the cached file stays usable for the next aerodrome
  const out = await new Promise((ok, ko) => { const tm = setTimeout(() => ko(new Error('timeout')), 20000);
    wk.onmessage = e => { clearTimeout(tm); e.data.ok ? ok(e.data) : ko(new Error(e.data.err)); }; wk.onerror = e => { clearTimeout(tm); ko(new Error(e.message || 'worker')); };
    wk.postMessage({ buf: copy, w: W, h: H, b }, [copy]); });
  const cv = document.createElement('canvas'); cv.width = out.w; cv.height = out.h; const g = cv.getContext('2d');
  g.fillStyle = '#eef3f6'; g.fillRect(0, 0, cv.width, cv.height);
  const X = lon => (lon - b[0]) / (b[2] - b[0]) * cv.width, Y = lat => (my(b[3]) - my(lat)) / (my(b[3]) - my(b[1])) * cv.height;
  g.strokeStyle = '#7d8f9b'; g.lineWidth = 1; g.beginPath();
  for (const line of coast) { let pen = false; for (const [lo, la] of line) { if (lo < b[0] - 2 || lo > b[2] + 2 || la < b[1] - 2 || la > b[3] + 2) { pen = false; continue; } const x = X(lo), y = Y(la); if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } } }
  g.stroke();
  const tmp = document.createElement('canvas'); tmp.width = out.w; tmp.height = out.h; tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.w, out.h), 0, 0);
  g.drawImage(tmp, 0, 0);
  const ax = X(ap.lon), ay = Y(ap.lat); g.fillStyle = '#c2185b'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(ax, ay, 4.5, 0, 7); g.fill(); g.stroke();
  /* 50 km scale bar */
  const km = 50, px = km / (111.32 * Math.cos(ap.lat * D)) / (b[2] - b[0]) * cv.width; g.fillStyle = '#24323d'; g.fillRect(8, cv.height - 10, px, 3);
  g.font = '10px ui-monospace,monospace'; g.fillText('50 km', 8, cv.height - 14);
  return { url: cv.toDataURL('image/png'), t, any: (out.max || 0) >= 0.1 };
}

/* the coloured box on the METAR line: EASA/SERA wording on purpose, not the U.S. VFR/MVFR/IFR/LIFR categories */
function badge(metar, L) {
  const st = status(metar); if (!st) return '';
  const txt = st.cls === 'ok' ? 'VFR' : st.svfr ? L({ en: 'Special VFR only', no: 'Kun spesiell VFR' }) : L({ en: 'IFR only', no: 'Kun IFR' }); // below 1500 m or 600 ft neither VFR nor special VFR is possible in a control zone // the rules are in the tooltip, not on the box
  const det = st.cavok ? 'CAVOK' : fmtVis(st.vis) + ' · ' + (fmtCeil(st.ceil) ? L({ en: 'ceiling ', no: 'skydekke ' }) + fmtCeil(st.ceil) : L({ en: 'no ceiling', no: 'ingen ceiling' }));
  const tip = L({ en: 'Control zone, SERA.5005: VFR needs ground visibility ≥ 5 km and ceiling ≥ 1500 ft. Special VFR, SERA.5010: 1500 m and 600 ft with ATC clearance. Below 1500 m or 600 ft: IFR only. Only the SERA minima are used, no other categories. Planning aid only.',
    no: 'Kontrollsone, SERA.5005: VFR krever bakkesikt ≥ 5 km og skydekke ≥ 1500 ft. Spesiell VFR, SERA.5010: 1500 m og 600 ft med klarering. Under 1500 m eller 600 ft: kun IFR. Bare SERA-minimaene brukes, ingen andre kategorier. Bare planleggingshjelp.' });
  return ` <span class="icb-badge ${st.cls}${st.svfr ? ' svfr' : ''}" title="${esc(tip + ' (' + det + ')')}">${esc(txt)}</span>`;
}

/* IFR, the EASA way: there is no IFR weather category. What a METAR alone can answer is the approach ban for non-commercial
   operations, NCO.OP.210: with a controlling RVR below 550 m the approach is not continued below 1 000 ft above the aerodrome.
   Everything else (NCO.OP.160: destination or alternate at or above the aerodrome operating minima) depends on the approach's
   DA/MDA and RVR/VIS from the chart, so the box says to compare with them instead of guessing a colour. CAT operators use their
   own minimum (CAT.OP.MPA.305). */
function ifr(metar) {
  const p = parseMetar(metar); if (!p) return null;
  const low = p.rvr.filter(r => !r.more && r.m < 550);
  return { ban: low.length > 0, low, rvr: p.rvr, vis: p.vis, ceil: p.ceil };
}
function ifrBadge(metar, L) {
  const x = ifr(metar); if (!x) return '';
  const rv = r => (r.less ? '<' : r.more ? '>' : '') + r.m + ' m';
  const txt = x.ban ? L({ en: 'IFR · approach ban', no: 'IFR · innflygingsforbud' }) + ' (' + x.low.map(r => 'RWY ' + r.rwy + ' RVR ' + rv(r)).join(', ') + ')'
    : x.rvr.length ? L({ en: 'IFR · RVR ', no: 'IFR · RVR ' }) + x.rvr.map(r => r.rwy + ' ' + rv(r)).join(', ') + L({ en: ' · compare with approach minima', no: ' · sammenlign med innflygingsminima' })
    : L({ en: 'IFR · compare with approach minima', no: 'IFR · sammenlign med innflygingsminima' });
  const tip = L({ en: 'EASA has no IFR weather category. NCO.OP.160: an IFR flight needs the destination, or a destination alternate, at or above the aerodrome operating minima (DA/MDA and RVR/VIS of the approach) at the estimated time of arrival. NCO.OP.210: with a controlling (touchdown) RVR below 550 m, do not continue the approach below 1 000 ft above the aerodrome. Commercial operators: their own minimum, CAT.OP.MPA.305. Planning aid only.',
    no: 'EASA har ingen IFR-kategori for vær. NCO.OP.160: en IFR-flyging krever at destinasjonen, eller en alternativ flyplass, er på eller over aerodrome operating minima (DA/MDA og RVR/sikt for innflygingen) ved beregnet ankomst. NCO.OP.210: er styrende RVR (touchdown) under 550 m, fortsetter du ikke innflygingen under 1000 ft over flyplassen. Kommersielle operatører: eget minimum, CAT.OP.MPA.305. Bare planleggingshjelp.' });
  return ` <span class="icb-badge ${x.ban ? 'no' : 'ifr'}" title="${esc(tip)}">${esc(txt)}</span>`;
}

/* ---------- fetching and the row ---------- */
const TTL = { sig: 5 * 60e3, frz: 60 * 60e3, rad: 10 * 60e3 };
function ensure(icao, ap, redraw) {
  if (!ap) return; const c = C[icao] || (C[icao] = { busy: {} });
  const run = (k, fn) => { if (c.busy[k] || (c[k + 'At'] && Date.now() - c[k + 'At'] < TTL[k])) return; c.busy[k] = 1;
    fn().then(v => { c[k] = v; c[k + 'Err'] = 0; }).catch(() => { c[k + 'Err'] = 1; }).finally(() => { c[k + 'At'] = Date.now(); c.busy[k] = 0; redraw(); }); };
  run('sig', () => getSig(icao, ap)); run('frz', () => getFrz(ap)); run('rad', () => getRadar(ap));
}
function html(icao, metar, L, ap) {
  const c = C[icao] || { busy: {} }; const lines = [];
  const wait = L({ en: 'fetching…', no: 'henter …' });
  /* 2 */
  if (c.sig) { if (!c.sig.length) lines.push(`<span class="icb-l">${L({ en: 'No SIGMET in force over the aerodrome', no: 'Ingen SIGMET i kraft over flyplassen' })}</span>`);
    else c.sig.slice(0, 3).forEach(x => { const lv = x.base || x.top ? ` ${x.base || ''}${x.top ? '–' + x.top : ''}` : ''; const until = x.to ? ' ' + L({ en: 'until', no: 'til' }) + ' ' + x.to.slice(11, 16) + 'Z' : '';
      lines.push(`<span class="icb-l icb-sig"><b>${esc(x.type)}:</b> ${esc(L({ en: x.label, no: SIGNO[x.label] || x.label }))}${esc(lv)}${until}${x.area ? '' : ' <small>(' + esc(L({ en: 'whole FIR, no area given', no: 'hele FIR, uten område' })) + ')</small>'}</span>`); }); }
  else if (c.sigErr) lines.push(`<span class="icb-l"><small>${L({ en: 'SIGMETs could not be fetched', no: 'SIGMET kunne ikke hentes' })}</small></span>`);
  else lines.push(`<span class="icb-l"><small>SIGMET: ${wait}</small></span>`);
  /* 3 */
  if (c.frz) { const below = ap && ap.el != null && c.frz.ft <= ap.el; lines.push(`<span class="icb-l">${L({ en: 'Freezing level', no: 'Frysenivå' })} ${below ? L({ en: 'at or below the aerodrome', no: 'ved eller under flyplassen' }) : '≈ ' + c.frz.ft.toLocaleString('en-GB').replace(/,/g, ' ') + ' ft'} <small>(${L({ en: 'GFS forecast', no: 'GFS-prognose' })}${c.frz.valid ? ' ' + esc(String(c.frz.valid).slice(11, 16)) + 'Z' : ''})</small></span>`); }
  else if (!c.frzErr) lines.push(`<span class="icb-l"><small>${L({ en: 'Freezing level', no: 'Frysenivå' })}: ${wait}</small></span>`);
  const img = c.rad ? `<figure class="icb-rad"><img src="${c.rad.url}" alt="${esc(L({ en: 'Radar around ', no: 'Radar rundt ' }) + icao)}" width="150" height="90"><figcaption>${c.rad.any ? '' : L({ en: 'No precipitation · ', no: 'Ingen nedbør · ' })}${esc(c.rad.t.slice(9, 11) + ':' + c.rad.t.slice(11, 13))}Z · © EUMETNET</figcaption></figure>`
    : c.radErr ? '' : `<figure class="icb-rad wait"><span>${L({ en: 'Radar', no: 'Radar' })}: ${wait}</span></figure>`;
  return `<span class="icb"><span class="icb-ls"><b class="icb-h">${L({ en: 'Now at ', no: 'Nå på ' })}${esc(icao)}</b>${lines.join('')}<small class="icb-n">${L({ en: 'Planning aid. The ATIS, the official briefing and the rules decide.', no: 'Planleggingshjelp. ATIS, offisiell briefing og reglene avgjør.' })}</small></span>${img}</span>`;
}
const SIGNO = { 'Severe icing': 'Kraftig ising', 'Severe icing (freezing rain)': 'Kraftig ising (underkjølt regn)', 'Severe turbulence': 'Kraftig turbulens', 'Moderate icing': 'Moderat ising',
  'Moderate turbulence': 'Moderat turbulens', 'Severe mountain wave': 'Kraftige fjellbølger', 'Moderate mountain wave': 'Moderate fjellbølger', 'Volcanic ash': 'Vulkansk aske',
  'Cumulonimbus': 'Cumulonimbus', 'Isolated thunderstorms': 'Isolert tordenvær', 'Occasional thunderstorms': 'Spredt tordenvær', 'Mountains obscured': 'Fjell skjult i sky',
  'Low cloud': 'Lavt skydekke', 'Reduced surface visibility': 'Redusert sikt ved bakken', 'Strong surface wind': 'Sterk vind ved bakken' };
const CSS = '.icb{display:flex;gap:12px;align-items:flex-start;width:100%}.icb-ls{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.icb-h{margin-bottom:1px}'
  + '.icb-l{font-size:13.5px}.icb-l small,.icb-st small{color:var(--ink-2,#5b6770)}.icb-sig b{color:#b35c00}.icb-n{color:var(--ink-2,#5b6770);font-size:11.5px;margin-top:2px}'
  + '.icb-st{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:13.5px}.icb-st i{width:11px;height:11px;border-radius:50%;flex:none;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.12)}'
  + '.icb-st.ok i{background:#1e8e3e}.icb-st.near i{background:#e8a200}.icb-st.no i{background:#d93025}'
  + '.icb-badge{display:inline-block;margin:0 0 0 8px;padding:1px 7px;border-radius:3px;font:600 11.5px/1.6 var(--f-mono,ui-monospace,monospace);letter-spacing:.02em;color:#fff;vertical-align:1px;white-space:normal;max-width:100%;margin-top:2px}'
  + '.icb-badge.ok{background:#1e8e3e}.icb-badge.no{background:#d93025}.icb-badge.svfr{background:#c2410c}.icb-badge.ifr{background:#3d5566}'
  + '.icb-rad{margin:0;flex:none;width:150px}.icb-rad img{display:block;width:150px;height:90px;border-radius:3px;border:1px solid var(--rule,#d5dce1)}'
  + '.icb-rad figcaption{font:10.5px/1.3 var(--f-mono,ui-monospace,monospace);color:var(--ink-2,#5b6770);margin-top:2px}'
  + '.icb-rad.wait{height:90px;border:1px dashed var(--rule,#d5dce1);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-2,#5b6770)}'
  + '@media (max-width:560px){.icb{flex-direction:column}.icb-rad,.icb-rad img{width:100%;height:auto}.icb-rad.wait{width:100%}}';
if (typeof document !== 'undefined' && !document.getElementById('icb-css')) { const s = document.createElement('style'); s.id = 'icb-css'; s.textContent = CSS; document.head.appendChild(s); }
const API = { ensure, html, badge, ifr, ifrBadge, status, parseMetar, inPoly };
G.ICB = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
