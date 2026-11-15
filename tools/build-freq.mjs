/* Builds data/freq/<prefix>.json (aerodrome frequencies by the first two letters of the ICAO code) for the airports in
   data/nav-eu.json, from OurAirports (public domain): https://github.com/davidmegginson/ourairports-data
   Run: node tools/build-freq.mjs path/to/airport-frequencies.csv   (download the CSV first)
   Output: { "ENGM": [["TWR","GARDERMOEN TOWER","118.300"], …], … } — split by prefix so a click loads a few KB. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const csv = readFileSync(process.argv[2] || 'airport-frequencies.csv', 'utf8');
const nav = JSON.parse(readFileSync(join(ROOT, 'data/nav-eu.json'), 'utf8'));
const want = new Set(nav.ap.map(a => a[0]));
function row(line) { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
const lines = csv.split(/\r?\n/).filter(Boolean); const head = row(lines[0]);
const I = k => head.indexOf(k); const iId = I('airport_ident'), iT = I('type'), iD = I('description'), iF = I('frequency_mhz');
const by = {};
for (const l of lines.slice(1)) { const r = row(l), id = r[iId]; if (!want.has(id)) continue; const f = parseFloat(r[iF]); if (!(f >= 108 && f < 137)) continue;
  (by[id] = by[id] || []).push([String(r[iT] || '').trim().toUpperCase(), String(r[iD] || '').trim(), f.toFixed(3)]); }
const shards = {};
for (const id of Object.keys(by).sort()) { const list = by[id].sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));
  const seen = new Set(); (shards[id.slice(0, 2)] = shards[id.slice(0, 2)] || {})[id] = list.filter(x => { const k = x[0] + x[2]; if (seen.has(k)) return false; seen.add(k); return true; }); }
const dir = join(ROOT, 'data/freq'); mkdirSync(dir, { recursive: true }); for (const f of readdirSync(dir)) unlinkSync(join(dir, f));
let n = 0, bytes = 0; for (const [p, o] of Object.entries(shards)) { const t = JSON.stringify(o); writeFileSync(join(dir, p + '.json'), t); n += Object.keys(o).length; bytes += t.length; }
console.log(Object.keys(shards).length + ' files, ' + n + ' aerodromes with frequencies, ' + Math.round(bytes / 1024) + ' KB in all');
