/* Birdbird – find the aerodrome page (AD 2, with the charts in AD 2.24) in the current edition of a national eAIP.

   resolve('ENTO', deps) → { ok:true, icao, url, kind:'ad2', state, name, eff } when the state publishes its eAIP openly and the
   aerodrome is in it; otherwise { ok:false, icao, url, kind:'portal'|'ead'|'dir', name } with the best official page to open.

   How it stays current without anyone touching it: every state below has an index page that lists its editions
   (the AIRAC dates). We read that page, take the newest edition that is already in force (effective date ≤ today, UTC),
   then read that edition's table of contents and find the AD 2 page of the aerodrome. Both steps are cached at the edge
   for a few hours, so a new AIRAC is picked up the same day it takes effect. Nothing of the AIP is copied or stored:
   we only follow the state's own links and send the user there.

   If a state changes its website so the lookup fails, the user still gets the state's AIP portal (never a dead link),
   and the weekly check (tests/aip-links.mjs) e-mails the repository owner. */

export const UA = 'Mozilla/5.0 (compatible; Birdbird/1.0; +https://birdbird.eu)';
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/* Official AIP portals (what the user gets when no AD 2 page can be found). */
const N = (name, url) => ({ name, url, kind: 'portal' });
export const PORTAL = {
  EN: N('Avinor AIP Norway', 'https://ais.avinor.no/'),
  ES: N('LFV AIP Sweden', 'https://aro.lfv.se/content/eaip/default_offline.html'),
  EK: N('Naviair AIP Denmark', 'https://aim.naviair.dk/'),
  BG: N('Naviair AIP Greenland', 'https://aim.naviair.dk/'),
  EF: N('Fintraffic AIP Finland', 'https://www.ais.fi/eaip/'),
  BI: N('Isavia AIP Iceland', 'https://eaip.isavia.is/'),
  ED: N('DFS AIP Germany', 'https://aip.dfs.de/basicAIP/'),
  ET: N('DFS AIP Germany', 'https://aip.dfs.de/basicAIP/'),
  EG: N('NATS AIP United Kingdom', 'https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/'),
  EH: N('LVNL AIP Netherlands', 'https://www.lvnl.nl/diensten/aip'),
  EB: N('skeyes AIP Belgium and Luxembourg', 'https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/index-en-GB.html'),
  EL: N('skeyes AIP Belgium and Luxembourg', 'https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/index-en-GB.html'),
  EP: N('PANSA AIP Poland', 'https://www.ais.pansa.pl/en/publications/aip-poland/'),
  EE: N('EANS AIP Estonia', 'https://eaip.eans.ee/'),
  EV: N('LGS AIP Latvia', 'https://ais.lgs.lv/aiseaip'),
  LO: N('Austro Control AIP Austria', 'https://eaip.austrocontrol.at/'),
  LF: N('SIA AIP France', 'https://www.sia.aviation-civile.gouv.fr/'),
  LG: N('HASP AIP Greece', 'https://aisgr.hasp.gov.gr'),
  LH: N('HungaroControl AIP Hungary', 'https://ais-en.hungarocontrol.hu/aip/'),
  LI: N('ENAV AIP Italy', 'https://onlineservices.enav.it/enavWebPortalStatic/AIP/AIP/default.html'),
  LK: N('ANS CR AIP Czech Republic', 'https://aim.rlp.cz/eaip/html/index-en-GB.html'),
  LP: N('NAV Portugal AIP', 'https://ais.nav.pt/online-eaip-en/'),
  LE: N('ENAIRE AIP Spain', 'https://aip.enaire.es/AIP/AIP-en.html'),
  GC: N('ENAIRE AIP Spain', 'https://aip.enaire.es/AIP/AIP-en.html'),
  LZ: N('LPS AIP Slovak Republic', 'https://aim.lps.sk/web/index.php?fn=200&lng=en')
};
export const EAD = { name: 'EUROCONTROL EAD Basic', url: 'https://www.ead.eurocontrol.int/cms-eadbasic/opencms/en/login/ead-basic', kind: 'ead' };
export const DIR = { name: 'EUROCONTROL @IS Online', url: 'https://www.eurocontrol.int/articles/ais-online', kind: 'dir' };
/* ICAO prefixes of the other European (ECAC) states: their AIPs are in EAD Basic */
const EUR = /^(E[EIVY]|L[ABCDHJKMNQRSTUWXYZ]|UK|UD|UB|UG)/;

/* How to find the edition in force and the AD 2 page, state by state.
   idx:   page that lists the editions (redirects are followed)
   rx:    finds one edition in idx; named groups: p (path of the edition, relative to idx), y m d (or yy m d, or mon)
   base:  turns p into the folder the toc and the pages are relative to
   fixed: a folder that always holds the edition in force (no idx needed)
   toc:   table of contents, relative to base; every link in it that names the aerodrome and AD 2 is a candidate
   tpl:   the AD 2 page by name, when the state names its pages the standard way; checked before it is used */
export const STATES = {
  EN: { idx: 'https://aim-prod.avinor.no/no/AIP/', rx: /href="(?<p>(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})-AIRAC)\/html\/index-/g, base: p => p + '/html/', tpl: 'eAIP/EN-AD-2.{I}-en-GB.html' },
  ES: { idx: 'https://aro.lfv.se/content/eaip/default_offline.html', rx: /href="(?<p>[^"\\]*?_(?<y>\d{4})_(?<m>\d{2})_(?<d>\d{2}))\\index-v2\.html"/g, base: p => encodeURI(p) + '/', toc: 'v2/js/datasource.js', tocBase: 'eAIP/' },
  EF: { idx: 'https://www.ais.fi/eaip/', rx: /href="(?<p>[^"\\]*?_(?<y>\d{4})_(?<m>\d{2})_(?<d>\d{2}))\\index\.html"/g, base: p => encodeURI(p) + '/', toc: 'eAIP/menu.html' },
  BI: { idx: 'https://eaip.isavia.is/', rx: /\/\/eaip\.(?:isavia|avians)\.is\/(?<p>A_\d+-\d{4}_(?<y>\d{4})_(?<m>\d{2})_(?<d>\d{2}))\//g, base: p => p + '/', toc: 'eAIP/menu.html' },
  EG: { idx: 'https://nats-uk.ead-it.com/cms-nats/opencms/en/Publications/AIP/', rx: /(?<p>https?:\/\/www\.aurora\.nats\.co\.uk\/htmlAIP\/Publications\/(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})-AIRAC)\/html\/index-en-GB\.html/g, base: p => p + '/html/', tpl: 'eAIP/EG-AD-2.{I}-en-GB.html', abs: true },
  EB: { fixed: 'https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/', tpl: 'eAIP/EB-AD-2.{I}-en-GB.html' },
  EP: { idx: 'https://www.ais.pansa.pl/en/publications/aip-poland/', rx: /(?<p>https:\/\/docs\.pansa\.pl\/ais\/eaipifr\/default_offline_(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})\.html)/g, abs: true,
        idx2: { rx: /href="(?<p>[^"\\]*?_(?<y>\d{4})_(?<m>\d{2})_(?<d>\d{2}))\\index-v2\.html"/g, base: p => encodeURI(p) + '/' }, toc: 'v2/js/datasource.js', tocBase: 'eAIP/' },
  EE: { idx: 'https://eaip.eans.ee/', follow: true, toc: 'eAIP/EE-menu-en-GB.html', tpl: 'eAIP/EE-AD-2.{I}-en-GB.html' },
  EV: { idx: 'https://ais.lgs.lv/aiseaip', rx: /(?<p>eAIPfiles\/[^"' ]*?\/data\/(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2}))\/html\/index\.html/g, base: p => p + '/html/', tpl: 'eAIP/EV-AD-2.{I}-en-GB.html' },
  LH: { idx: 'https://ais-en.hungarocontrol.hu/aip/', rx: /\.\/(?<p>(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2}))\/eaip\.zip/g, base: p => p + '/' + p + '-AIRAC/html/', tpl: 'eAIP/LH-AD-2.{I}-en-HU.html' },
  LP: { fixed: 'https://ais.nav.pt/wp-content/uploads/AIS_Files/eAIP_Current/eAIP_Online/eAIP/html/', tpl: 'eAIP/LP-AD-2.{I}-en-PT.html' },
  LZ: { idx: 'https://aim.lps.sk/web/index.php?fn=200&lng=en', rx: /(?<p>https:\/\/aim\.lps\.sk\/web\/eAIP_SR\/AIP_SR_EFF_(?<d>\d{2})(?<mon>[A-Z]{3})(?<y>\d{4})(?:_amdt)?)\/html\/LZ-frameset-en-SK\.html/g, base: p => p + '/html/', abs: true, toc: 'LZ-menu-en-SK.html' },
  LK: { fixed: 'https://aim.rlp.cz/eaip/html/', toc: 'eAIP/LK-menu-en-GB.html', tpl: 'eAIP/LK-AD-2.{I}-en-GB.html' },
  LO: { idx: 'https://eaip.austrocontrol.at/', rx: /\.\/(?<p>lo\/(?<yy>\d{2})(?<m>\d{2})(?<d>\d{2}))\/index\.htm/g, base: p => p + '/', part: 'ad.htm' },
  LF: { airac: d => { const [y, m, dd] = d.split('-'); const mon = Object.keys(MON)[+m - 1]; return `https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_${dd}_${mon}_${y}/FRANCE/AIRAC-${d}/html/`; },
        tpl: ['eAIP/FR-AD-2.{I}-en-GB.html', 'eAIP/FR-AD-2.{I}-fr-FR.html'], toc: 'eAIP/FR-menu-fr-FR.html' },
  LE: { fixed: 'https://aip.enaire.es/AIP/', toc: 'AIP-en.html', lang: /_en\./ }
};
STATES.EL = STATES.EB; STATES.GC = STATES.LE;

export function portalFor(icao) {
  const p = icao.slice(0, 2);
  return PORTAL[p] || (EUR.test(icao) ? EAD : DIR);
}
export const supported = icao => !!STATES[String(icao).slice(0, 2)];

const ymd = d => d.toISOString().slice(0, 10);
function dateOf(g) {
  const y = g.y ? +g.y : 2000 + +g.yy, m = g.mon ? MON[g.mon.toUpperCase()] : +g.m, d = +g.d;
  if (!y || !m || !d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/* the newest edition already in force; an edition published ahead of its date is skipped until that date */
export function pickEdition(text, rx, today) {
  let best = null; rx.lastIndex = 0;
  for (const m of text.matchAll(rx)) {
    const eff = dateOf(m.groups); if (!eff || eff > today) continue;
    if (!best || eff > best.eff) best = { eff, p: m.groups.p };
  }
  return best;
}
/* every link in a table of contents that points at the AD 2 page of this aerodrome */
export function findAd2(text, icao, lang) {
  const out = [];
  const rx = /(?:href|"href")\s*[=:]\s*["']([^"'#]+)(?:#[^"']*)?["']/gi;
  for (const m of text.matchAll(rx)) {
    const h = m[1].replace(/&amp;/g, '&'); const u = h.toUpperCase();
    if (!u.includes(icao)) continue;
    const d = u.replace(/%20/g, ' ');
    if (!/(^|[^A-Z])AD[\s_\-.]*2(?![0-9])/.test(d) && !new RegExp('(^|[^A-Z])AD[\\s_\\-.]+' + icao).test(d)) continue;
    out.push(h);
  }
  if (!out.length) return null;
  const score = h => (/en-GB|-en-|_en[._]|-en\./i.test(h) ? 4 : 0) + (lang && lang.test(h) ? 4 : 0) + (/AD[\s_\-.]*(?:%20)?2[.\s_-]1\b/i.test(h) ? 1 : 0) - (/\.pdf$/i.test(h) ? 1 : 0) - h.length / 1000;
  return out.sort((a, b) => score(b) - score(a))[0];
}

async function getText(fetchFn, url) {
  const r = await fetchFn(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/javascript,*/*' }, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return { text: await r.text(), url: r.url || url };
}
async function exists(fetchFn, url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetchFn(url, { method, headers: { 'user-agent': UA }, redirect: 'follow' });
      if (r.body && method === 'GET') { try { r.body.cancel(); } catch (e) {} }
      if (r.ok) return true;
      if (r.status === 404 || r.status === 410) return false;
      if (r.status === 401 || r.status === 403) return null;
    } catch (e) {}
  }
  return false;
}
/* AIRAC effective dates repeat every 28 days (29 OCT 2026 is one) */
export function airacOf(today) {
  const ref = Date.UTC(2026, 9, 29), t = Date.parse(today + 'T00:00:00Z');
  const n = Math.floor((t - ref) / (28 * 864e5));
  return new Date(ref + n * 28 * 864e5).toISOString().slice(0, 10);
}

/* the edition in force for a state: { base, eff } */
export async function edition(st, deps) {
  const fetchFn = deps.fetch, today = deps.today || ymd(new Date());
  if (st.fixed) return { base: st.fixed, eff: null };
  if (st.airac) { const eff = airacOf(today); return { base: st.airac(eff), eff }; }
  const page = await getText(fetchFn, st.idx);
  if (st.follow) return { base: page.url.replace(/[^/]*$/, ''), eff: (page.url.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null };
  let ed = pickEdition(page.text, st.rx, today);
  if (!ed) throw new Error('no edition in force on ' + st.idx);
  let at = new URL(st.base ? st.base(ed.p) : ed.p, page.url).href;
  if (st.idx2) {
    const p2 = await getText(fetchFn, new URL(ed.p, page.url).href);
    const e2 = pickEdition(p2.text, st.idx2.rx, today);
    if (!e2) throw new Error('no edition in force on ' + p2.url);
    at = new URL(st.idx2.base(e2.p), p2.url).href; ed = e2;
  }
  return { base: at, eff: ed.eff };
}

/* cache helpers: one small JSON per state and edition, a few hours at the edge */
const CK = k => new Request('https://birdbird.eu/__aipcache/' + encodeURIComponent(k));
async function cget(cache, k) { if (!cache) return null; try { const r = await cache.match(CK(k)); return r ? await r.json() : null; } catch (e) { return null; } }
async function cput(cache, k, v, ttl, deps) {
  if (!cache) return;
  const p = cache.put(CK(k), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ttl } })).catch(() => {});
  if (deps.waitUntil) deps.waitUntil(p); else await p;
}

export async function resolve(icaoIn, deps) {
  deps = deps || {};
  const icao = String(icaoIn || '').toUpperCase().trim();
  if (!/^[A-Z]{2}[A-Z0-9]{2}$/.test(icao)) return { ok: false, error: 'bad_icao' };
  const fallback = Object.assign({ ok: false, icao }, portalFor(icao));
  const pre = icao.slice(0, 2), st = STATES[pre];
  if (!st) return fallback;
  const cache = deps.cache === undefined ? (typeof caches !== 'undefined' ? caches.default : null) : deps.cache;
  const today = deps.today || ymd(new Date());
  try {
    // 1. the edition in force (cached 3 h, keyed by day so a new AIRAC is never missed past midnight UTC)
    const ek = 'ed:' + pre + ':' + today;
    let ed = await cget(cache, ek);
    if (!ed) { ed = await edition(st, Object.assign({}, deps, { today })); await cput(cache, ek, ed, 10800, deps); }
    const name = PORTAL[pre] ? PORTAL[pre].name : 'eAIP';
    const done = url => ({ ok: true, icao, url, kind: 'ad2', name, eff: ed.eff });
    // 2. the aerodrome's page (cached 6 h per edition)
    const ak = 'ad:' + icao + ':' + ed.base;
    const hit = await cget(cache, ak);
    if (hit && hit.url) return done(hit.url);
    if (hit) return st.part ? Object.assign({}, fallback, { url: new URL(st.part, ed.base).href, kind: 'part', name }) : fallback;
    let url = null;
    for (const t of [].concat(st.tpl || [])) { const u = new URL(t.replace('{I}', icao), ed.base).href; const x = await exists(deps.fetch, u); if (x || (x === null && !st.toc)) { url = u; break; } }
    if (!url && st.toc) {
      const toc = await getText(deps.fetch, new URL(st.toc, ed.base).href);
      const h = findAd2(toc.text, icao, st.lang);
      if (h) url = new URL(h, st.tocBase ? new URL(st.tocBase, ed.base).href : toc.url).href;
    }
    await cput(cache, ak, { url }, 21600, deps);
    if (url) return done(url);
    return st.part ? Object.assign({}, fallback, { url: new URL(st.part, ed.base).href, kind: 'part', name }) : fallback;
  } catch (e) {
    if (deps.log) deps.log(pre + ': ' + (e && e.message || e));
    return Object.assign({ lookupFailed: true }, fallback);
  }
}
