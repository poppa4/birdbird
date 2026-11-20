/* NORDAP – forecast outlook for one aerodrome at one hour: "how will the weather be at ENTO on Monday at 10?"
   Several independent weather models are read for the aerodrome's position and boiled down to what a pilot plans with:
   cloud layers (base, top, amount), ceiling, visibility, wind and gusts, freezing level, precipitation, icing, convection,
   and an estimated SERA status. Where the models disagree it says so (range and confidence) instead of hiding it.

   Sources (all free, all credited on the page):
     MET Norway locationforecast 2.0 (CC BY 4.0) — the Norwegian met service; MEPS 2.5 km over the Nordics, ECMWF beyond.
     Open-Meteo (CC BY 4.0, free for non-commercial use; a paid Open-Meteo plan is needed once NORDAP charges money), one call
       per model so a model that is down or unknown only drops itself:
       ECMWF IFS, DWD ICON, UK Met Office, DMI HARMONIE-AROME (2 km, Northern Europe, ~2.5 days), NOAA GFS.
       Each gives a vertical profile on pressure levels (height, temperature, humidity, cloud), from which the layers are found.
     NOAA GFS cloud base/top as the model itself diagnoses them (this site's /api/clouds), used for the GFS member's layers.
   The official TAF is added when it covers the hour asked for: then that is the forecast to plan with.

   A model estimate, never an official forecast or briefing. The page and the search bar say so every time. */

export const FT = 3.28084;
export const SPAN = 6; // hours either side of the hour asked for
export const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300];
export const MODELS = [
  { id: 'ecmwf', om: ['ecmwf_ifs025', 'ecmwf_ifs'], name: 'ECMWF IFS', by: 'ECMWF' },
  { id: 'icon', om: ['icon_seamless'], name: 'ICON', by: 'DWD' },
  { id: 'ukmo', om: ['ukmo_seamless'], name: 'UKMO', by: 'UK Met Office' },
  { id: 'harmonie', om: ['dmi_seamless'], name: 'HARMONIE-AROME', by: 'DMI' },
  { id: 'gfs', om: ['gfs_seamless'], name: 'GFS', by: 'NOAA' }
];
const SFC = ['temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'precipitation', 'snowfall', 'showers', 'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'freezing_level_height', 'cape', 'pressure_msl'];
const PL = p => [`temperature_${p}hPa`, `relative_humidity_${p}hPa`, `geopotential_height_${p}hPa`];
const PLCC = p => `cloud_cover_${p}hPa`;
const WIND = LEVELS.flatMap(p => [`wind_speed_${p}hPa`, `wind_direction_${p}hPa`]);
/* three tiers: if Open-Meteo rejects a variable for a model (400), the next tier asks for less */
export const VAR_TIERS = [
  [...SFC, ...LEVELS.flatMap(PL), ...LEVELS.map(PLCC), ...WIND],
  [...SFC, ...LEVELS.flatMap(PL), ...WIND],
  SFC
];

const num = v => (v == null || v === '' || !isFinite(v)) ? null : +v;
const r100 = v => v == null ? null : Math.round(v / 100) * 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const median = a => { const b = a.filter(v => v != null && !Number.isNaN(v)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] === Infinity || b[m] === Infinity ? b[m] : (b[m - 1] + b[m]) / 2); };
const isoHour = d => new Date(d).toISOString().slice(0, 13) + ':00';

/* cloud amount in % → the METAR words, by oktas (1–2 FEW, 3–4 SCT, 5–7 BKN, 8 OVC) */
export function amount(pct) {
  if (pct == null) return null; const o = pct / 12.5;
  return o < 0.5 ? null : o < 2.5 ? 'FEW' : o < 4.5 ? 'SCT' : o < 7.5 ? 'BKN' : 'OVC';
}
const isCeil = a => a === 'BKN' || a === 'OVC';

/* ---------- vertical profile → cloud layers ---------- */
/* pts: [{ z (ft AMSL), t (°C), rh (%), cc (% or null) }] from the ground up.
   A level is in cloud when the model's cloud cover there is ≥ 40 %, or (no cover given) the humidity is near saturation —
   a little lower over ice when it is cold. Base and top are interpolated between the levels. */
/* at the ground (sfc) only near-saturation counts: that is fog or cloud on the ground, not 93 % humidity under a stratus deck */
const rhThr = p => p.sfc ? 98 : p.t != null && p.t < -15 ? 85 : 92;
const wet = p => p.cc != null ? p.cc >= 40 : (p.rh != null && p.rh >= rhThr(p));
const wetness = p => p.cc != null ? p.cc - 40 : (p.rh == null ? -99 : p.rh - rhThr(p));
function cross(a, b) { const both = a.cc != null && b.cc != null, w = p => both ? p.cc - 40 : (p.rh == null ? wetness(p) : p.rh - rhThr(p)); const fa = w(a), fb = w(b); const f = fa === fb ? 0.5 : clamp(fa / (fa - fb), 0, 1); return a.z + f * (b.z - a.z); }
const rhCover = rh => rh >= 99 ? 95 : rh >= 96 ? 75 : rh >= 93 ? 45 : 25;
export function layersFromProfile(pts) {
  const out = []; let cur = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], w = wet(p);
    if (w && !cur) cur = { base: i === 0 ? p.z : cross(pts[i - 1], p), top: p.z, cover: 0, tBase: p.t, tTop: p.t };
    if (w) { cur.top = p.z; cur.tTop = p.t; cur.cover = Math.max(cur.cover, p.cc != null ? p.cc : rhCover(p.rh)); }
    if (!w && cur) { cur.top = cross(pts[i - 1], p); out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  /* layers with less than 500 ft clear air between them are one layer */
  const m = [];
  for (const l of out) { const prev = m[m.length - 1]; if (prev && l.base - prev.top < 500) { prev.top = l.top; prev.tTop = l.tTop; prev.cover = Math.max(prev.cover, l.cover); } else m.push({ ...l }); }
  return m;
}

/* temperature at a height, from the profile */
export function tempAt(pts, z) {
  if (!pts.length) return null; if (z <= pts[0].z) return pts[0].t;
  for (let i = 1; i < pts.length; i++) if (z <= pts[i].z) { const a = pts[i - 1], b = pts[i]; if (a.t == null || b.t == null) return a.t ?? b.t; return a.t + (b.t - a.t) * (z - a.z) / (b.z - a.z); }
  return pts[pts.length - 1].t;
}
/* height where the profile is at temperature T (first crossing from below), ft AMSL */
export function heightOf(pts, T) {
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (a.t == null || b.t == null) continue;
    if ((a.t - T) * (b.t - T) <= 0 && a.t !== b.t) return a.z + (T - a.t) / (b.t - a.t) * (b.z - a.z); }
  return null;
}

/* ---------- one model, one hour ---------- */
/* convective (cumulus) cloud base from the temperature–dew point spread: about 400 ft per °C */
export const lclFt = (t, td) => t == null || td == null ? null : Math.max(0, (t - td) * 400);

export function omMember(j, i, elevFt) {
  const h = j.hourly || {}; const g = k => num(h[k] && h[k][i]);
  const T = g('temperature_2m'), Td = g('dew_point_2m'), RH = g('relative_humidity_2m');
  const pts = [{ z: elevFt, t: T, rh: RH, cc: null, sfc: true }];
  for (const p of LEVELS) { const zm = g(`geopotential_height_${p}hPa`); if (zm == null) continue; const z = zm * FT; if (z <= elevFt + 80) continue;
    pts.push({ z, t: g(`temperature_${p}hPa`), rh: g(`relative_humidity_${p}hPa`), cc: g(PLCC(p)) }); }
  pts.sort((a, b) => a.z - b.z);
  /* winds and temperature aloft, level by level (Windy's "altitude" slider, all at once) */
  const lv = LEVELS.map(p => ({ p, z: g(`geopotential_height_${p}hPa`), t: g(`temperature_${p}hPa`), rh: g(`relative_humidity_${p}hPa`), dir: g(`wind_direction_${p}hPa`), kt: g(`wind_speed_${p}hPa`) }))
    .filter(x => x.z != null && x.z * FT > elevFt + 80).map(x => ({ ...x, z: x.z * FT }));
  const cov = { low: g('cloud_cover_low'), mid: g('cloud_cover_mid'), high: g('cloud_cover_high'), total: g('cloud_cover') };
  const precip = g('precipitation'), showers = g('showers'), cape = g('cape');
  let layers = pts.length > 3 ? layersFromProfile(pts) : [];
  /* the bands' cover (low up to ~6 500 ft above ground, mid to ~26 000 ft, high above) caps what the humidity suggests */
  const band = z => z - elevFt < 6500 ? cov.low : z - elevFt < 26000 ? cov.mid : cov.high;
  const hasCc = pts.some(p => p.cc != null);
  layers = layers.map(l => { const b = band(l.base); return { ...l, cover: !hasCc && b != null ? Math.min(l.cover, b) : l.cover }; }).filter(l => l.cover >= 6);
  /* low cloud in the band but no layer found (the levels are 1 000–2 000 ft apart near the ground): cumulus/stratus at the spread height */
  const lcl = lclFt(T, Td);
  if (cov.low != null && cov.low >= 12 && !layers.some(l => l.base - elevFt < 6500) && lcl != null)
    layers.unshift({ base: elevFt + clamp(lcl, 200, 6000), top: elevFt + clamp(lcl, 200, 6000) + 1500, cover: cov.low, tBase: null, tTop: null, est: 'spread' });
  layers.forEach(l => { l.tBase = l.tBase ?? tempAt(pts, l.base); l.tTop = l.tTop ?? tempAt(pts, l.top); });
  const conv = cape != null && cape >= 100 && ((showers || 0) > 0 || (precip || 0) > 0.2);
  return {
    t2: T, td: Td, rh: RH, vis: g('visibility'), precip, snow: g('snowfall'), showers, cape, code: g('weather_code'),
    wind: { dir: g('wind_direction_10m'), kt: g('wind_speed_10m'), gust: g('wind_gusts_10m') },
    w850: { dir: g('wind_direction_850hPa'), kt: g('wind_speed_850hPa') }, w700: { dir: g('wind_direction_700hPa'), kt: g('wind_speed_700hPa') },
    frz: g('freezing_level_height') != null ? g('freezing_level_height') * FT : heightOf(pts, 0), m10: heightOf(pts, -10), m20: heightOf(pts, -20),
    cov, layers: layers.map(l => ({ base: l.base, top: l.top, cover: Math.round(l.cover), amt: amount(l.cover), tBase: l.tBase, tTop: l.tTop, est: l.est || null })),
    lcl, conv, warmAloft: pts.slice(1).some(p => p.t != null && p.t > 0.5), profile: pts.length > 3, pts, lv, qnh: g('pressure_msl')
  };
}

/* MET Norway locationforecast: no vertical profile, so layer heights come from the spread; amounts are MET's own */
export function metMember(ts, elevFt) {
  const d = (ts.data && ts.data.instant && ts.data.instant.details) || {};
  const n1 = ts.data && (ts.data.next_1_hours || ts.data.next_6_hours) || {}; const nd = n1.details || {};
  const per = ts.data && ts.data.next_1_hours ? 1 : 6;
  const T = num(d.air_temperature), Td = num(d.dew_point_temperature), lcl = lclFt(T, Td);
  const cov = { low: num(d.cloud_area_fraction_low), mid: num(d.cloud_area_fraction_medium), high: num(d.cloud_area_fraction_high), total: num(d.cloud_area_fraction) };
  const fog = num(d.fog_area_fraction);
  const layers = [];
  if (fog != null && fog >= 25) layers.push({ base: elevFt, top: elevFt + 500, cover: Math.round(fog), amt: amount(fog), est: 'fog' });
  if (cov.low != null && cov.low >= 6) { const b = elevFt + clamp(lcl ?? 1500, 300, 6000); layers.push({ base: b, top: b + 1500, cover: Math.round(cov.low), amt: amount(cov.low), est: 'spread' }); }
  const precip = nd.precipitation_amount != null ? +nd.precipitation_amount / per : null;
  const sym = n1.summary && n1.summary.symbol_code || '';
  return {
    t2: T, td: Td, rh: num(d.relative_humidity), vis: null, precip, snow: /snow/.test(sym) ? precip : /sleet/.test(sym) ? (precip || 0) / 2 : 0, showers: /showers/.test(sym) ? precip : 0,
    cape: null, code: null, sym, thunder: num(nd.probability_of_thunder), pop: num(nd.probability_of_precipitation),
    wind: { dir: num(d.wind_from_direction), kt: d.wind_speed != null ? d.wind_speed * 1.94384 : null, gust: d.wind_speed_of_gust != null ? d.wind_speed_of_gust * 1.94384 : null },
    w850: {}, w700: {}, frz: null, m10: null, m20: null, cov, fog, layers, lcl, conv: /thunder/.test(sym), warmAloft: false, profile: false, lv: [], qnh: num(d.air_pressure_at_sea_level)
  };
}

/* GFS cloud layers as GFS diagnoses them (/api/clouds tile): replace the GFS member's humidity-derived layers */
export function gfsLayers(tile, lat, lon, elevFt) {
  if (!tile || !tile.ok) return null;
  const i = clamp(Math.round((tile.la0 - lat) / tile.d), 0, (tile.ny || tile.lc.length) - 1), k = clamp(Math.round((lon - tile.lo0) / tile.d), 0, (tile.nx || tile.lc[0].length) - 1);
  const v = key => tile[key] && tile[key][i] ? num(tile[key][i][k]) : null;
  const out = [];
  [['lc', 'lb', 'lt'], ['mc', 'mb', 'mt'], ['hc', 'hb', 'ht']].forEach(([c, b, t]) => { const cv = v(c), bb = v(b), tt = v(t);
    if (cv != null && cv >= 6 && bb != null) out.push({ base: Math.max(elevFt, bb), top: Math.max(elevFt + 300, tt ?? bb + 2000), cover: Math.round(cv), amt: amount(cv), est: null }); });
  const ceil = v('ceil');
  return { layers: out.sort((a, b) => a.base - b.base), ceil: ceil != null ? Math.max(elevFt, ceil) : null, valid: tile.valid || null, run: tile.run || null };
}

/* ---------- what each member means for the pilot ---------- */
export function sera(ceilAgl, vis) {
  if (vis == null) return null; const c = ceilAgl == null ? Infinity : ceilAgl;
  return vis >= 5000 && c >= 1500 ? 'vfr' : vis >= 1500 && c >= 600 ? 'svfr' : 'ifr';
}
export function summarise(m, elevFt) {
  const agl = z => z == null ? null : Math.max(0, z - elevFt);
  const ceilL = m.layers.find(l => isCeil(l.amt)); const lowL = m.layers[0];
  return { ceil: ceilL ? agl(ceilL.base) : null, lowest: lowL ? agl(lowL.base) : null, lowestAmt: lowL ? lowL.amt : null };
}

/* ---------- all members → one answer ---------- */
const vmeanDir = arr => { let x = 0, y = 0, n = 0; arr.forEach(w => { if (w.dir == null || w.kt == null) return; const a = w.dir * Math.PI / 180; x += Math.sin(a) * (w.kt || 0.1); y += Math.cos(a) * (w.kt || 0.1); n++; });
  if (!n) return null; let d = Math.atan2(x, y) * 180 / Math.PI; if (d <= 0) d += 360; return Math.round(d / 10) * 10 || 360; };
const range = a => { const b = a.filter(v => v != null && isFinite(v)); return b.length ? [Math.min(...b), Math.max(...b)] : null; };

export function consensus(members, elevFt, leadH, opts) {
  opts = opts || {};
  const ok = members.filter(m => m && m.x);
  const prof = ok.filter(m => m.x.profile || m.native);
  const S = ok.map(m => ({ id: m.id, ...summarise(m.x, elevFt) }));
  const SP = S.filter(s => prof.some(p => p.id === s.id));
  const use = SP.length ? SP : S;
  const ceilMed = median(use.map(s => s.ceil == null ? Infinity : s.ceil));
  const lowMed = median(use.map(s => s.lowest == null ? Infinity : s.lowest));
  const visArr = ok.map(m => m.x.vis).filter(v => v != null);
  let vis = median(visArr);
  /* fog: saturated at the ground with little wind, in the majority of members */
  const fogVotes = ok.filter(m => { const x = m.x; return (x.fog != null && x.fog >= 30) || (x.t2 != null && x.td != null && x.t2 - x.td <= 1 && (x.wind.kt == null || x.wind.kt <= 6)) || (x.layers[0] && x.layers[0].base - elevFt < 150 && isCeil(x.layers[0].amt)); }).length;
  const fog = ok.length ? fogVotes / ok.length : 0;
  if (fog >= 0.5 && (vis == null || vis > 1000)) vis = vis == null ? 800 : Math.min(vis, 1500);
  const winds = ok.map(m => m.x.wind).filter(w => w.kt != null);
  const wind = { dir: vmeanDir(winds), kt: median(winds.map(w => w.kt)), gust: median(winds.map(w => w.gust)), gustMax: range(winds.map(w => w.gust)) ? range(winds.map(w => w.gust))[1] : null };
  const w850 = ok.map(m => m.x.w850).filter(w => w && w.kt != null), w700 = ok.map(m => m.x.w700).filter(w => w && w.kt != null);
  const frzArr = ok.map(m => m.x.frz).filter(v => v != null);
  const t2 = median(ok.map(m => m.x.t2)), td = median(ok.map(m => m.x.td));
  const precip = median(ok.map(m => m.x.precip)), snow = median(ok.map(m => m.x.snow));
  const capeMax = range(ok.map(m => m.x.cape)), thunder = ok.map(m => m.x.thunder).find(v => v != null);
  const convFrac = ok.length ? ok.filter(m => m.x.conv).length / ok.length : 0;
  /* precipitation type, from the 2 m temperature and the layer above */
  let ptype = null;
  if (precip != null && precip >= 0.1) {
    const warmAloft = ok.filter(m => m.x.warmAloft).length > ok.length / 2;
    ptype = t2 != null && t2 < 0 && warmAloft ? 'fzra' : (snow != null && snow > 0 && (t2 == null || t2 <= 1.5)) || (t2 != null && t2 <= 0.5) ? 'snow' : t2 != null && t2 <= 2 ? 'sleet' : 'rain';
    if (ok.filter(m => (m.x.showers || 0) > 0).length > ok.length / 2) ptype += '-sh';
  }
  /* representative member: the profile model whose ceiling is closest to the median — its layers draw the picture */
  const lg = v => Math.log10((v == null ? 30000 : Math.min(v, 30000)) + 100);
  let rep = null, best = Infinity;
  for (const s of use) { const d = Math.abs(lg(s.ceil) - lg(ceilMed === Infinity ? null : ceilMed)) + 0.5 * Math.abs(lg(s.lowest) - lg(lowMed === Infinity ? null : lowMed)); if (d < best) { best = d; rep = s.id; } }
  const R = ok.find(m => m.id === rep);
  const layers = R ? R.x.layers.map(l => ({ base: Math.max(0, r100(l.base - elevFt)), top: Math.max(0, r100(l.top - elevFt)), amt: l.amt, tBase: l.tBase == null ? null : Math.round(l.tBase), tTop: l.tTop == null ? null : Math.round(l.tTop) })) : [];
  /* icing: cloud between 0 and −20 °C in the representative profile, more when it is near 0 to −10 */
  const frz = median(frzArr);
  let icing = null;
  if (R) { const ice = R.x.layers.filter(l => { const a = l.tBase, b = l.tTop; return a != null && b != null && Math.max(a, b) > -20 && Math.min(a, b) < 0.5 && (isCeil(l.amt) || l.amt === 'SCT'); });
    if (ice.length) { const lo = Math.max(ice[0].base, frz != null ? Math.min(frz, ice[0].top) : ice[0].base), hi = Math.min(Math.max(...ice.map(l => l.top)), R.x.m20 || Infinity);
      const sev = ptype && ptype.startsWith('fzra') ? 'severe' : ice.some(l => l.tBase != null && l.tBase > -12 && isCeil(l.amt)) && (precip || 0) >= 0.3 ? 'moderate' : 'light';
      icing = { from: r100(lo), to: r100(hi === Infinity ? Math.max(...ice.map(l => l.top)) : hi), sev }; } }
  const cats = S.map(s => sera(s.ceil, ok.find(m => m.id === s.id).x.vis ?? vis)).filter(Boolean);
  const cat = sera(ceilMed === Infinity ? null : ceilMed, vis);
  const agree = cats.length ? cats.filter(c => c === cat).length / cats.length : null;
  /* close to a limit: amber */
  const near = cat === 'vfr' && ((ceilMed !== Infinity && ceilMed < 2000) || (vis != null && vis < 7000) || (agree != null && agree < 0.75));
  const spreadCeil = range(use.map(s => s.ceil));
  let conf = leadH <= 24 ? 2 : leadH <= 72 ? 1 : 0;
  if (agree != null && agree < 0.6) conf--; if (agree != null && agree >= 0.9 && leadH <= 72) conf = Math.max(conf, 1);
  if (use.length < 2 || leadH > 168) conf = Math.min(conf, 0);
  conf = ['low', 'medium', 'high'][clamp(conf, 0, 2)];
  /* aloft: median height, temperature and humidity per pressure level, vector-mean wind */
  const aloft = [];
  for (const p of [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300]) {
    const xs = ok.map(m => (m.x.lv || []).find(v => v.p === p)).filter(Boolean); if (!xs.length) continue;
    const ws = xs.filter(v => v.kt != null);
    aloft.push({ p, z: r100(median(xs.map(v => v.z))), t: median(xs.map(v => v.t)) == null ? null : Math.round(median(xs.map(v => v.t))), rh: median(xs.map(v => v.rh)) == null ? null : Math.round(median(xs.map(v => v.rh))),
      dir: ws.length ? vmeanDir(ws) : null, kt: ws.length ? Math.round(median(ws.map(v => v.kt))) : null, ktRange: ws.length > 1 ? range(ws.map(v => Math.round(v.kt))) : null, n: xs.length });
  }
  const covMed = k => { const v = median(ok.map(m => m.x.cov && m.x.cov[k])); return v == null ? null : Math.round(v); };
  const qnh = median(ok.map(m => m.x.qnh)), pop = ok.map(m => m.x.pop).find(v => v != null);
  return {
    aloft, qnh: qnh == null ? null : Math.round(qnh), cov: { low: covMed('low'), mid: covMed('mid'), high: covMed('high'), total: covMed('total') }, pop: pop ?? null,
    n: ok.length, ceil: ceilMed === Infinity ? null : r100(ceilMed), ceilRange: spreadCeil && [r100(spreadCeil[0]), r100(spreadCeil[1])], ceilNone: use.filter(s => s.ceil == null).length,
    lowest: lowMed === Infinity ? null : r100(lowMed), lowestAmt: R ? (R.x.layers[0] || {}).amt || null : null,
    vis: vis == null ? null : vis >= 10000 ? 10000 : vis >= 5000 ? Math.round(vis / 1000) * 1000 : Math.round(vis / 100) * 100, visRange: range(visArr), fog: fog >= 0.5 ? 'likely' : fog >= 0.25 ? 'possible' : null,
    wind: { dir: wind.dir, kt: wind.kt == null ? null : Math.round(wind.kt), gust: wind.gust != null && wind.kt != null && wind.gust - wind.kt >= 8 ? Math.round(wind.gust) : null, gustMax: wind.gustMax == null ? null : Math.round(wind.gustMax) },
    w850: w850.length ? { dir: vmeanDir(w850), kt: Math.round(median(w850.map(w => w.kt))) } : null,
    w700: w700.length ? { dir: vmeanDir(w700), kt: Math.round(median(w700.map(w => w.kt))) } : null,
    frz: frz == null ? null : (t2 != null && t2 <= 0 ? 0 : r100(Math.max(elevFt, frz))), frzRange: range(frzArr) && range(frzArr).map(r100),
    t2: t2 == null ? null : Math.round(t2), td: td == null ? null : Math.round(td),
    precip: precip == null ? null : Math.round(precip * 10) / 10, ptype,
    cape: capeMax ? Math.round(capeMax[1]) : null, thunder: thunder ?? null, cb: (capeMax && capeMax[1] >= 800) || (thunder != null && thunder >= 20) ? 'likely' : convFrac >= 0.4 || (capeMax && capeMax[1] >= 300) || (thunder != null && thunder >= 5) ? 'possible' : null,
    turb: wind.gustMax != null && wind.gustMax >= 30 ? 'moderate' : wind.gust != null && wind.kt != null && wind.gust - wind.kt >= 15 ? 'moderate' : wind.gust != null && wind.gust >= 20 ? 'light' : null,
    icing, layers, rep, sera: cat, near, agree, conf
  };
}

/* ---------- fetching ---------- */
const UA = 'NORDAP/1.0 (+https://nordap.eu)';
const OM = 'https://api.open-meteo.com/v1/forecast';
const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';

export function omUrl(model, vars, lat, lon, elevFt, t0, t1) {
  const q = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), elevation: String(Math.round(elevFt / FT)), hourly: vars.join(','), models: model,
    timezone: 'GMT', wind_speed_unit: 'kn', start_hour: isoHour(t0), end_hour: isoHour(t1), cell_selection: 'land' });
  return OM + '?' + q.toString();
}

async function getJ(fetchFn, url, ttl, timeout) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout || 9000);
  try {
    const r = await fetchFn(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal, cf: { cacheTtl: ttl || 1800, cacheEverything: true } });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    return { status: r.status, j };
  } finally { clearTimeout(tm); }
}

async function fetchModel(fetchFn, M, lat, lon, elevFt, t0, t1) {
  let note = null;
  for (const om of M.om) for (const vars of VAR_TIERS) {
    try {
      const { status, j } = await getJ(fetchFn, omUrl(om, vars, lat, lon, elevFt, t0, t1));
      if (status === 200 && j && j.hourly && j.hourly.time) return { j, om, tier: VAR_TIERS.indexOf(vars) };
      note = (j && j.reason) || 'HTTP ' + status;
      if (status !== 400) return { err: note };
    } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : 'network' }; }
  }
  return { err: note || 'no data' };
}

/* hours: list of ISO hour strings (UTC) the answer covers; tIdx: the one asked for */
export async function buildOutlook(p, deps) {
  const fetchFn = deps.fetch, now = deps.now ? deps.now() : Date.now();
  const { lat, lon, elevFt, t, origin, icao } = p;
  const H = 36e5, T = Date.parse(t);
  const hours = []; for (let k = -SPAN; k <= SPAN; k++) hours.push(new Date(T + k * H).toISOString().slice(0, 13) + ':00Z');
  const t0 = T - SPAN * H, t1 = T + SPAN * H;
  const jobs = MODELS.map(M => fetchModel(fetchFn, M, lat, lon, elevFt, t0, t1).then(r => ({ M, ...r })));
  const metJob = getJ(fetchFn, `${MET}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&altitude=${Math.round(elevFt / FT)}`, 1800).catch(() => ({ status: 0, j: null }));
  const tileLa = Math.floor(lat / 5) * 5, tileLo = Math.floor(lon / 5) * 5;
  const gfsJob = origin && T - now < 120 * H ? getJ(fetchFn, `${origin}/api/clouds?tile=${tileLa},${tileLo}&t=${new Date(T).toISOString().slice(0, 13)}:00Z`, 1800, 20000).catch(() => ({ status: 0, j: null })) : Promise.resolve({ status: 0, j: null });
  const wxJob = origin && icao ? getJ(fetchFn, `${origin}/api/wx?ids=${icao}`, 300, 9000).catch(() => ({ status: 0, j: null })) : Promise.resolve({ status: 0, j: null });
  const [res, met, gfs, wx] = await Promise.all([Promise.all(jobs), metJob, gfsJob, wxJob]);

  const sources = [];
  const perHour = hours.map(() => []);
  for (const r of res) {
    if (r.err) { sources.push({ id: r.M.id, name: r.M.name, by: r.M.by, ok: false, note: r.err }); continue; }
    const times = r.j.hourly.time.map(x => x.slice(0, 13));
    let any = false;
    hours.forEach((h, hi) => { const i = times.indexOf(h.slice(0, 13)); if (i < 0) return; const x = omMember(r.j, i, elevFt);
      if (x.t2 == null && x.wind.kt == null) return; any = true; perHour[hi].push({ id: r.M.id, x }); });
    sources.push({ id: r.M.id, name: r.M.name, by: r.M.by, ok: any, note: any ? (r.tier ? 'fewer levels' : null) : 'outside the model\'s range' });
  }
  /* GFS: the model's own cloud base/top for the hour asked for */
  const gl = gfs.status === 200 ? gfsLayers(gfs.j, lat, lon, elevFt) : null;
  const tIdx = SPAN;
  if (gl) { const gm = perHour[tIdx].find(m => m.id === 'gfs');
    if (gm) { gm.x.layers = gl.layers.map(l => ({ ...l, tBase: tempAt(gm.x.pts, l.base), tTop: tempAt(gm.x.pts, l.top) })); gm.native = true; } }
  /* MET Norway */
  let metOk = false;
  const mts = met.status === 200 && met.j && met.j.properties && met.j.properties.timeseries || [];
  if (mts.length) hours.forEach((h, hi) => { const target = Date.parse(h); let bestTs = null, bd = Infinity;
    for (const ts of mts) { const d = Math.abs(Date.parse(ts.time) - target); if (d < bd) { bd = d; bestTs = ts; } }
    if (bestTs && bd <= (hi === tIdx ? 3 * H : 0.5 * H)) { perHour[hi].push({ id: 'met', x: metMember(bestTs, elevFt) }); metOk = true; } });
  sources.unshift({ id: 'met', name: 'MET Norway', by: 'MET Norway', ok: metOk, note: metOk ? null : (met.status ? 'HTTP ' + met.status : 'no answer') });
  if (gl) sources.push({ id: 'gfsn', name: 'GFS cloud base/top', by: 'NOAA', ok: true, note: gl.run ? 'run ' + gl.run : null });

  const leadH = Math.round((T - now) / H);
  const out = hours.map((h, hi) => ({ t: h, cons: perHour[hi].length ? consensus(perHour[hi], elevFt, leadH + hi - tIdx) : null }));
  /* the members of each hour, short, for the profile and the model table */
  const short = list => list.map(m => { const s = summarise(m.x, elevFt); const x = m.x;
    return { id: m.id, ceil: s.ceil == null ? null : r100(s.ceil), lowest: s.lowest == null ? null : r100(s.lowest), lowestAmt: s.lowestAmt, est: (x.layers[0] || {}).est || null,
      vis: x.vis == null ? null : Math.round(x.vis / 100) * 100, wind: { dir: x.wind.dir == null ? null : Math.round(x.wind.dir / 10) * 10 || 360, kt: x.wind.kt == null ? null : Math.round(x.wind.kt), gust: x.wind.gust == null ? null : Math.round(x.wind.gust) },
      frz: x.frz == null ? null : r100(x.frz), precip: x.precip == null ? null : Math.round(x.precip * 10) / 10, cape: x.cape == null ? null : Math.round(x.cape), thunder: x.thunder ?? null,
      t2: x.t2 == null ? null : Math.round(x.t2), td: x.td == null ? null : Math.round(x.td),
      layers: x.layers.map(l => ({ base: Math.max(0, r100(l.base - elevFt)), top: Math.max(0, r100(l.top - elevFt)), amt: l.amt })), sera: null, native: !!m.native };
  });
  out.forEach((h, hi) => { h.members = short(perHour[hi]); h.members.forEach(m => { m.sera = sera(m.ceil, m.vis ?? (h.cons && h.cons.vis)); }); });
  const members = out[tIdx].members;
  /* the official forecast, when it covers the hour */
  let taf = null, metar = null;
  const st = wx.status === 200 && wx.j && wx.j.stations && wx.j.stations[icao];
  if (st && st.taf) taf = { raw: st.taf.raw, validFrom: st.taf.validFrom, validTo: st.taf.validTo, covers: !!(st.taf.validFrom && st.taf.validTo && Date.parse(st.taf.validFrom) <= T && T < Date.parse(st.taf.validTo)) };
  if (st && st.metar) metar = st.metar;
  return { ok: true, icao: icao || null, lat, lon, elevFt, t: hours[tIdx], leadH, generated: new Date(now).toISOString(), hours: out, tIdx, members, sources, taf, metar };
}

/* ---------- the area around the aerodrome ---------- */
/* The same analysis at 17 points around the aerodrome (the centre, then 8 bearings at half the radius and at the radius),
   from one high-resolution model in one call: ICON (DWD; ICON-D2 2 km, ICON-EU 7 km) up to 7 days, ECMWF beyond.
   Each point uses its own ground height (Open-Meteo's terrain), so cloud base is above the ground there. */
export function areaPoints(lat, lon, rNm) {
  const pts = [{ lat, lon, brg: null, d: 0 }];
  for (const f of [0.5, 1]) for (let b = 0; b < 360; b += 45) {
    const d = rNm * f, a = b * Math.PI / 180;
    pts.push({ lat: Math.round((lat + d / 60 * Math.cos(a)) * 1e4) / 1e4, lon: Math.round((lon + d / 60 * Math.sin(a) / Math.cos(lat * Math.PI / 180)) * 1e4) / 1e4, brg: b, d });
  }
  return pts;
}
export async function buildArea(p, deps) {
  const fetchFn = deps.fetch, now = deps.now ? deps.now() : Date.now();
  const { lat, lon, t, rNm } = p; const H = 36e5, T = Date.parse(t);
  const pts = areaPoints(lat, lon, rNm);
  const hours = []; for (let k = -SPAN; k <= SPAN; k++) hours.push(new Date(T + k * H).toISOString().slice(0, 13) + ':00Z');
  const lead = (T - now) / H;
  const models = lead <= 7 * 24 ? ['icon_seamless', 'ecmwf_ifs025', 'ecmwf_ifs'] : ['ecmwf_ifs025', 'ecmwf_ifs'];
  let arr = null, used = null, note = null;
  outer: for (const om of models) for (const vars of VAR_TIERS) {
    const q = new URLSearchParams({ latitude: pts.map(x => x.lat.toFixed(4)).join(','), longitude: pts.map(x => x.lon.toFixed(4)).join(','), hourly: vars.join(','), models: om,
      timezone: 'GMT', wind_speed_unit: 'kn', start_hour: isoHour(T - SPAN * H), end_hour: isoHour(T + SPAN * H) });
    try {
      const { status, j } = await getJ(fetchFn, OM + '?' + q.toString(), 1800, 12000);
      if (status === 200 && j) { arr = Array.isArray(j) ? j : [j]; used = om; break outer; }
      note = (j && j.reason) || 'HTTP ' + status; if (status !== 400) break outer;
    } catch (e) { note = 'network'; break outer; }
  }
  if (!arr || arr.length !== pts.length) return { ok: false, error: 'upstream', message: 'The model for the area could not be read right now.', note };
  const name = { icon_seamless: 'ICON (DWD)', ecmwf_ifs025: 'ECMWF IFS', ecmwf_ifs: 'ECMWF IFS' }[used];
  const out = hours.map(h => ({ t: h, pts: [] }));
  arr.forEach((j, pi) => {
    const elevFt = (num(j.elevation) ?? 0) * FT, times = (j.hourly && j.hourly.time || []).map(x => x.slice(0, 13));
    hours.forEach((h, hi) => { const i = times.indexOf(h.slice(0, 13)); if (i < 0) return; const x = omMember(j, i, elevFt);
      if (x.t2 == null && x.wind.kt == null) { out[hi].pts.push(null); return; }
      const c = consensus([{ id: 'm', x }], elevFt, lead);
      out[hi].pts.push({ ...pts[pi], el: Math.round(elevFt), sera: c.sera, lowest: c.lowest, lowestAmt: c.lowestAmt, ceil: c.ceil, vis: c.vis, fog: c.fog,
        wind: c.wind, precip: c.precip, ptype: c.ptype, cb: c.cb, cape: c.cape, frz: c.frz, t2: c.t2, cov: c.cov && c.cov.total, icing: c.icing, turb: c.turb }); });
  });
  return { ok: true, model: name, rNm, t: hours[SPAN], tIdx: SPAN, hours: out, generated: new Date(now).toISOString() };
}
