// The search bar finds Virtual Labs by their Key concepts through data/labindex.json (built by tools/lab-index.py from
// the rendered pages). These static checks fail when the index falls behind the labs: a lab added or renamed in lab.js,
// or a card key the index points to that is no longer in the lab's source. Run: node --test tests/labindex.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const lab = rd('lab.js');
const LABS = [...lab.matchAll(/\['([a-z0-9-]+\.html)','([a-z0-9]+)','([^']+)','([^']+)','[a-z]*'\]/g)].map(m => ({ f: m[1], en: m[3], no: m[4] }));
const IX = JSON.parse(rd('data/labindex.json')).labs;
const scriptsOf = html => [...html.matchAll(/<script src="([A-Za-z0-9.-]+\.js)(?:\?v=\d+)?"/g)].map(m => m[1]).filter(s => fs.existsSync(path.join(root, s)) && !/^(site|lab|three\.min|concepts|chartnote|glossary|search)\.js$/.test(s));

test('every lab is in the index, with its current name (re-run tools/lab-index.py after changing lab.js)', () => {
  for (const l of LABS) { const x = IX.find(i => i.f === l.f); assert.ok(x, `${l.f} is missing from data/labindex.json`); assert.equal(x.t.en, l.en, `${l.f}: name`); assert.equal(x.t.no, l.no, `${l.f}: Norwegian name`); }
});
test('every lab with Key concepts has its cards in the index, in both languages', () => {
  for (const l of LABS) { if (l.f === 'massbalance.html') continue; const x = IX.find(i => i.f === l.f);
    assert.ok(x.c.length >= 4, `${l.f}: only ${x.c.length} cards indexed`);
    for (const c of x.c) { assert.ok(c.t.en && c.t.no && c.d.en && c.d.no, `${l.f}: card "${c.t.en}" text`); assert.ok(c.k || c.href, `${l.f}: card "${c.t.en}" has no place to open`); } }
});
test('every indexed card key is still a card in its lab (a renamed or removed card needs tools/lab-index.py)', () => {
  for (const x of IX) { const html = rd(x.f), src = html + scriptsOf(html).map(rd).join('\n');
    for (const c of x.c) if (c.k) assert.ok([c.k, c.k.replace(/^[a-z]+-/, '')].some(k => new RegExp(`['"\`]${k}['"\`]`).test(src)), `${x.f}: card key "${c.k}" (${c.t.en}) is not in the lab's source`); }
});
test('the search bar reads the index and opens cards by #kc-<key>', () => {
  const s = rd('search.js'), k = rd('concepts.js');
  assert.match(s, /data\/labindex\.json/); assert.match(s, /'#kc-'/); assert.match(k, /function kcHash\(\)/); assert.match(k, /addEventListener\('hashchange',kcHash\)/);
});
