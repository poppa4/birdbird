// Live check, run on GitHub Actions (tools/live-check.yml): calls the real upstream sources and the deployed site,
// runs Birdbird's own handlers against the real data, and writes what it saw to out/ for review.
import fs from 'node:fs';
import { handleSigmet, parseTac } from '../functions/api/sigmet.js';
import { handleWx } from '../functions/api/wx.js';
import { handleWinds } from '../functions/api/winds.js';
import { handleRadar } from '../functions/api/radar.js';
import { handleSat, LAYERS } from '../functions/api/sat.js';
import { handleSigchart } from '../functions/api/sigchart.js';
fs.mkdirSync('out', { recursive: true });
const W = (f, d) => fs.writeFileSync('out/' + f, typeof d === 'string' ? d : JSON.stringify(d, null, 1));
const UA = { 'user-agent': 'Birdbird/1.0 (+https://birdbird.eu) live-check' };
const rep = [];
const log = (k, v) => { rep.push(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v))); console.log(k, v); };
const T = async (k, fn) => { try { await fn(); } catch (e) { log(k + ' ERROR', String(e && e.stack || e).slice(0, 400)); } };
const deps = () => ({ fetch: (u, o) => fetch(u, Object.assign({}, o, { headers: Object.assign({}, UA, o && o.headers) })), cache: null, now: () => new Date(), waitUntil: () => {} });
const head = async (u, o) => { const r = await fetch(u, Object.assign({ headers: UA }, o)); const b = Buffer.from(await r.arrayBuffer()); return { status: r.status, type: r.headers.get('content-type'), len: b.length, b }; };

await T('raw MET sigmets', async () => { const r = await head('https://api.met.no/weatherapi/sigmets/2.0/'); W('met-sigmets.txt', r.b.toString()); log('raw MET sigmets', { status: r.status, type: r.type, len: r.len, head: r.b.toString().slice(0, 600) });
  const p = parseTac(r.b.toString(), new Date()); log('parseTac(MET)', { n: p.length, sample: p.slice(0, 4).map(x => ({ id: x.id, type: x.type, fir: x.fir, label: x.label, cat: x.cat, from: x.from, to: x.to, base: x.base, top: x.top, pts: x.poly && x.poly.length })) }); });
await T('raw MET airmets', async () => { const r = await head('https://api.met.no/weatherapi/sigmets/2.0/airmets'); W('met-airmets.txt', r.b.toString()); log('raw MET airmets', { status: r.status, len: r.len, head: r.b.toString().slice(0, 300) }); });
await T('raw isigmet', async () => { const r = await head('https://aviationweather.gov/api/data/isigmet?format=json'); W('isigmet.json', r.b.toString()); let j = []; try { j = JSON.parse(r.b.toString()); } catch (e) {} log('raw isigmet', { status: r.status, n: j.length, keys: j[0] && Object.keys(j[0]), first: j[0] && JSON.stringify(j[0]).slice(0, 700) }); });
await T('raw airsigmet', async () => { const r = await head('https://aviationweather.gov/api/data/airsigmet?format=json'); let j = []; try { j = JSON.parse(r.b.toString()); } catch (e) {} log('raw airsigmet', { status: r.status, n: j.length, keys: j[0] && Object.keys(j[0]), first: j[0] && JSON.stringify(j[0]).slice(0, 500) }); });
await T('handler sigmet', async () => { const r = await handleSigmet(new Request('https://x/api/sigmet'), {}, deps()); const j = await r.json(); W('h-sigmet.json', j); const by = {}; (j.items || []).forEach(x => { const k = x.source + ' ' + x.type; by[k] = (by[k] || 0) + 1; });
  log('handler sigmet', { status: r.status, ok: j.ok, n: (j.items || []).length, by, nopoly: (j.items || []).filter(x => !x.poly).length, eu: (j.items || []).filter(x => /^(E|L|B|U)/.test(x.fir || '')).slice(0, 8).map(x => x.fir + ' ' + x.type + ' ' + x.label + ' ' + x.cat + ' ' + x.base + '-' + x.top + ' pts' + (x.poly ? x.poly.length : 0)) }); });
await T('raw MET tafmetar', async () => { const r = await head('https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=ENNO'); log('raw MET metar ENNO', { status: r.status, head: r.b.toString().slice(-300) }); });
await T('handler wx', async () => { const t0 = Date.now(); const r = await handleWx(new Request('https://x/api/wx?ids=ENGM,ENNO,ENKJ,ENTO,ESSA,EDDF,EGLL,LFPG'), {}, deps()); const j = await r.json(); W('h-wx.json', j);
  log('handler wx', { ms: Date.now() - t0, status: r.status, missing: j.missing, st: Object.fromEntries(Object.entries(j.stations || {}).map(([k, v]) => [k, { src: v.source, metar: (v.metar && (v.metar.raw || v.metar) || '').toString().slice(0, 60), taf: !!v.taf }])) }); });
await T('handler winds', async () => { const t0 = Date.now(); const r = await handleWinds(new Request('https://x/api/winds?tile=55,5'), {}, deps()); const j = await r.json();
  log('handler winds', { status: r.status, ms: Date.now() - t0, ok: j.ok, err: j.error, run: j.run, fh: j.fh, valid: j.valid, nx: j.nx, ny: j.ny, lev: j.lev, u0: j.u && j.u[0] && j.u[0].slice(0, 3), z0: j.z && j.z[0] && j.z[0].slice(0, 3), t0: j.t && j.t[0] && j.t[0].slice(0, 3), r0: j.r && j.r[0] && j.r[0].slice(0, 3) }); });
await T('handler radar', async () => { const r = await handleRadar(new Request('https://x/api/radar'), {}, deps()); const j = await r.json(); log('handler radar', { status: r.status, j });
  if (j.url || j.t) { const u = j.t ? 'https://x/api/radar?t=' + j.t : null; if (u) { const r2 = await handleRadar(new Request(u), {}, deps()); const b = Buffer.from(await r2.arrayBuffer()); fs.writeFileSync('out/radar.h5', b); log('radar file', { status: r2.status, len: b.length, magic: b.slice(0, 8).toString('hex') }); } } });
await T('raw OPERA listing', async () => { const d = new Date(); const p = d.toISOString().slice(0, 10).replace(/-/g, '/'); const r = await head('https://s3.waw3-1.cloudferro.com/openradar-24h?prefix=' + p + '/OPERA/COMP/&max-keys=20'); log('raw OPERA listing', { status: r.status, head: r.b.toString().slice(0, 1500) }); });
await T('raw EUMETView caps', async () => { const r = await head('https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0'); const s = r.b.toString(); const names = [...s.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m => m[1]); log('raw EUMETView caps', { status: r.status, len: r.len, ours: LAYERS.map(l => l + ':' + names.includes(l)), ir: names.filter(n => /ir1(05|08)|ir_?10/i.test(n)).slice(0, 40) }); });
await T('handler sat', async () => { const h = new Date(); h.setUTCMinutes(0, 0, 0); h.setUTCHours(h.getUTCHours() - 1); const r = await handleSat(new Request('https://x/api/sat?bbox=0,7000000,2000000,9000000&t=' + h.toISOString()), {}, deps()); const b = Buffer.from(await r.arrayBuffer()); log('handler sat', { status: r.status, type: r.headers.get('content-type'), len: b.length, x: r.headers.get('x-layer') || '', txt: /image/.test(r.headers.get('content-type') || '') ? '' : b.toString().slice(0, 300) }); });
await T('handler sigchart', async () => { const r = await handleSigchart(new Request('https://x/api/sigchart?area=nordic&offset=1'), {}, deps()); const b = Buffer.from(await r.arrayBuffer()); log('handler sigchart', { status: r.status, type: r.headers.get('content-type'), len: b.length }); });
await T('openAIP tile', async () => { const { VectorTile } = await import('@mapbox/vector-tile'); const Pbf = (await import('pbf')).default; const z = 8, x = 136, y = 74; // around ENGM
  const r = await head(`https://api.tiles.openaip.net/api/data/openaip/${z}/${x}/${y}.pbf?apiKey=9f22478d838e75c88512f7131a079bfa`); const vt = new VectorTile(new Pbf(r.b)); const out = { status: r.status, layers: Object.keys(vt.layers) };
  const L = vt.layers.airspaces; if (L) { const keys = new Set(); const ex = []; for (let i = 0; i < L.length; i++) { const p = L.feature(i).properties; Object.keys(p).forEach(k => keys.add(k)); if (ex.length < 5 && /CTR|TMA|ATZ|TIZ/i.test(p.name || '')) ex.push(p); } out.airspaceKeys = [...keys]; out.examples = ex; }
  log('openAIP tile', out); });
for (const [k, u] of [['site sigmet', 'https://birdbird.eu/api/sigmet'], ['site wx', 'https://birdbird.eu/api/wx?ids=ENGM,ENNO,ENKJ'], ['site winds', 'https://birdbird.eu/api/winds?tile=55,5'], ['site radar', 'https://birdbird.eu/api/radar'], ['site sw', 'https://birdbird.eu/sw.js'], ['site atc', 'https://birdbird.eu/api/atc'], ['site me', 'https://birdbird.eu/api/me'], ['site room', 'https://birdbird.eu/api/room?c=test-test-0000'], ['site flows', 'https://birdbird.eu/flows'], ['site route', 'https://birdbird.eu/route']])
  await T(k, async () => { const t0 = Date.now(); const r = await head(u); log(k, { status: r.status, ms: Date.now() - t0, type: r.type, len: r.len, head: /json|javascript|text/.test(r.type || '') ? r.b.toString().slice(0, 400) : '' }); });
await T('site room roundtrip', async () => { const H = { 'content-type': 'application/json', origin: 'https://birdbird.eu' }, P = b => fetch('https://birdbird.eu/api/room', { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
  const c = await P({ op: 'create', flow: { name: 'live-check', roles: ['PF', 'PM'], steps: [{ id: 'a', r: 'PF', t: 'x', x: 1, y: 1 }] }, name: 'check', role: 'PF' }); if (!c.ok) { log('site room roundtrip', c); return; }
  const j = await P({ op: 'join', code: c.code, name: 'check2' }); const s = await P({ op: 'send', code: c.code, me: j.me, ev: { t: 'tap', x: 5, y: 6, ok: true } });
  const g = await (await fetch(`https://birdbird.eu/api/room?c=${c.code}&me=${c.me}&since=0`)).json(); await P({ op: 'leave', code: c.code, me: j.me }); await P({ op: 'leave', code: c.code, me: c.me });
  log('site room roundtrip', { code: c.code, joined: j.ok, members: j.members && j.members.length, sent: s.seq, got: g.ev && g.ev.map(e => e.t) }); });
W('report.txt', rep.join('\n'));
