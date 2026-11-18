/* NORDAP – sun and twilight for any position, computed here (NOAA solar-position equations, public domain; no outside
   data or service, so it is free to use commercially). Accuracy about one minute at Nordic latitudes, for sea-level
   horizon and standard refraction, as almanacs give it.
     sunrise/sunset   sun centre at −0.833° (refraction and the sun's radius)
     civil twilight   −6°   (EASA: night is from the end of evening civil twilight to the start of morning civil twilight)
     nautical         −12°
     astronomical     −18°
   SUN.day(date, lat, lon) → { noon, rise, set, civil:[dawn,dusk], nautical:[…], astro:[…], state } with Date objects (UTC
   instants) or null where the sun never reaches that angle that day (polar night, midnight sun, white nights).
   SUN.tzOf(icao) gives the aerodrome's time zone from its ICAO prefix, so times can be shown in local time there. */
(function (G) {
'use strict';
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const jd = ms => ms / 86400000 + 2440587.5;
/* solar declination (deg) and equation of time (min) at a Julian day */
function solar(J) {
  const T = (J - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * RAD);
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD)) * DEG;
  const y = Math.pow(Math.tan(eps * RAD / 2), 2);
  const eot = 4 * DEG * (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  return { dec, eot };
}
/* UTC minutes after 00:00 of the date when the sun is at elevation h (deg), rising (-1) or setting (+1); NaN if never */
function eventMin(day0, lat, lon, h, dir) {
  let t = 720 - 4 * lon; // first guess: local noon
  for (let i = 0; i < 3; i++) {
    const { dec, eot } = solar(jd(day0 + t * 60000));
    const c = (Math.sin(h * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
    if (c < -1 || c > 1) return { t: NaN, always: c < -1 };
    const H = Math.acos(c) * DEG;
    t = 720 - 4 * lon - eot + dir * 4 * H;
  }
  return { t };
}
function noonMin(day0, lon) { let t = 720 - 4 * lon; for (let i = 0; i < 2; i++) t = 720 - 4 * lon - solar(jd(day0 + t * 60000)).eot; return t; }
/* the local calendar day for the times: midnight UTC of the given date, shifted so the window covers the local day */
function day(date, lat, lon) {
  const d = new Date(date);
  const day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const at = m => (isNaN(m) ? null : new Date(day0 + Math.round(m * 60) * 1000));
  const pair = h => { const a = eventMin(day0, lat, lon, h, -1), b = eventMin(day0, lat, lon, h, +1);
    return { from: at(a.t), to: at(b.t), always: !!(a.always || b.always) && isNaN(a.t) }; };
  const sr = pair(-0.833), ci = pair(-6), na = pair(-12), as = pair(-18);
  const noon = at(noonMin(day0, lon));
  const elevNoon = 90 - Math.abs(lat - solar(jd(noon.getTime())).dec);
  const state = sr.from ? 'normal' : elevNoon > -0.833 ? 'midnight-sun' : ci.from ? 'polar-night-twilight' : elevNoon > -6 ? 'civil-all-day' : 'polar-night';
  return { noon, rise: sr.from, set: sr.to, civil: [ci.from, ci.to], nautical: [na.from, na.to], astro: [as.from, as.to],
    allDayLight: { sun: !sr.from && elevNoon > -0.833, civil: !ci.from && elevNoon > -6, nautical: !na.from && elevNoon > -12, astro: !as.from && elevNoon > -18 }, state };
}
/* ICAO prefix → IANA time zone (European aerodromes); unknown → null, then show UTC only */
const TZ = { EN: 'Europe/Oslo', ES: 'Europe/Stockholm', EK: 'Europe/Copenhagen', EF: 'Europe/Helsinki', BI: 'Atlantic/Reykjavik', EG: 'Europe/London',
  EI: 'Europe/Dublin', ED: 'Europe/Berlin', ET: 'Europe/Berlin', EH: 'Europe/Amsterdam', EB: 'Europe/Brussels', EL: 'Europe/Luxembourg', LF: 'Europe/Paris',
  LE: 'Europe/Madrid', GC: 'Atlantic/Canary', LP: 'Europe/Lisbon', LS: 'Europe/Zurich', LO: 'Europe/Vienna', LI: 'Europe/Rome', LM: 'Europe/Malta',
  EP: 'Europe/Warsaw', LK: 'Europe/Prague', LZ: 'Europe/Bratislava', LH: 'Europe/Budapest', LJ: 'Europe/Ljubljana', LD: 'Europe/Zagreb', LY: 'Europe/Belgrade',
  LQ: 'Europe/Sarajevo', LW: 'Europe/Skopje', LA: 'Europe/Tirane', LB: 'Europe/Sofia', LR: 'Europe/Bucharest', LG: 'Europe/Athens', LC: 'Asia/Nicosia',
  LT: 'Europe/Istanbul', EV: 'Europe/Riga', EY: 'Europe/Vilnius', EE: 'Europe/Tallinn', UK: 'Europe/Kyiv', UM: 'Europe/Minsk', LU: 'Europe/Chisinau',
  UB: 'Asia/Baku', UD: 'Asia/Yerevan', UG: 'Asia/Tbilisi', BK: 'Europe/Belgrade', LN: 'Europe/Monaco', BG: 'America/Nuuk' };
const EXACT = { LPAZ: 'Atlantic/Azores', LPPD: 'Atlantic/Azores', LPLA: 'Atlantic/Azores', LPHR: 'Atlantic/Azores', LPFL: 'Atlantic/Azores', LPCR: 'Atlantic/Azores',
  LPGR: 'Atlantic/Azores', LPPI: 'Atlantic/Azores', LPSJ: 'Atlantic/Azores', LPMA: 'Atlantic/Madeira', LPPS: 'Atlantic/Madeira', EKVG: 'Atlantic/Faroe',
  BGTL: 'America/Thule', BGSC: 'America/Scoresbysund', BGDH: 'America/Danmarkshavn' };
const tzOf = icao => { const k = String(icao || '').toUpperCase(); return EXACT[k] || TZ[k.slice(0, 2)] || null; };
/* "07:30" in a time zone (or UTC) */
function hm(d, tz) { if (!d) return '—'; try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'UTC' }).format(d).replace(/^24/, '00'); } catch (e) { return d.toISOString().slice(11, 16); } }
/* "UTC+1" for a zone at an instant */
function offset(d, tz) { if (!tz) return 'UTC'; try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(d).find(x => x.type === 'timeZoneName'); return (p && p.value || 'UTC').replace('GMT', 'UTC').replace(/^UTC$/, 'UTC±0'); } catch (e) { return ''; } }
/* calendar date "today" at the aerodrome, as a UTC midnight Date, so the times belong to the local day */
function localDate(now, tz) { if (!tz) return now; try { const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); return new Date(s + 'T00:00:00Z'); } catch (e) { return now; } }
const API = { day, tzOf, hm, offset, localDate, solar };
G.SUN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
