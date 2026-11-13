// The _headers file caches every .js, .css, font and model for a year ("immutable"). That is only safe while every reference
// to such a file carries ?v=N and all references to one file carry the same N. This test fails when one does not.
//   node --test tests/cache.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = fs.readdirSync(root).filter(f => /\.(html|js|css)$/.test(f) && f !== 'three.min.js');
const exists = p => fs.existsSync(path.join(root, p.replace(/^\.\//, '')));
/* quoted file names that are not URLs to fetch: CSS selectors in site.js, node's require in wsgraph3d.js, names in error messages */
const NOT_A_LOAD = [/script\[src\^=\\?["']$/, /require\(['"]$/, /Error\(['"]$/];
const refs = new Map();   // file -> Map(version|'' -> [where])
for (const f of sources) {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  const re = /(["'`(=])((?:\.\/|vendor\/|fonts\/|models\/)?[\w.\/-]+\.(?:js|css|woff2|glb))(\?v=[\w.]+)?(?=["'`)\s>+])/g; let m;
  while ((m = re.exec(s))) {
    const name = m[2].replace(/^\.\//, '');
    if (!exists(name) && !exists('vendor/' + name)) continue;            // not a file of this site (or a name built at run time)
    if (NOT_A_LOAD.some(r => r.test(s.slice(Math.max(0, m.index - 20), m.index + 1)))) continue;
    if (m[1] === '(' && !/url$/.test(s.slice(Math.max(0, m.index - 3), m.index))) continue;   // "(file.js)" in a comment
    if (m[1] === '=' ) continue;
    const key = exists(name) ? name : 'vendor/' + name;
    if (/\.woff2$/.test(key)) continue;                                   // fonts: the file name is the version (never edited in place)
    if (!refs.has(key)) refs.set(key, new Map());
    const v = m[3] || ''; const by = refs.get(key); if (!by.has(v)) by.set(v, []); by.get(v).push(f);
  }
}
test('every script, stylesheet and model reference carries ?v=', () => {
  const bad = [...refs].filter(([, by]) => by.has('')).map(([k, by]) => `${k} (in ${[...new Set(by.get(''))].join(', ')})`);
  assert.deepEqual(bad, []);
});
test('one ?v= per file site-wide', () => {
  const bad = [...refs].filter(([, by]) => by.size > 1).map(([k, by]) => `${k}: ${[...by].map(([v, w]) => `${v || 'none'} in ${[...new Set(w)].join(', ')}`).join(' | ')}`);
  assert.deepEqual(bad, []);
});
test('the reference scan sees the site (guards the test itself)', () => {
  for (const k of ['site.js', 'lab.js', 'site.css', 'three.min.js', 'search.js', 'account.js', 'glossary.js', 'vendor/pdf.min.js']) assert.ok(refs.has(k), k);
  assert.ok(refs.size > 100);
});
test('_headers caches only versioned kinds of file, and never HTML', () => {
  const h = fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n').filter(l => l && !l.startsWith('#') && !/^\s/.test(l));
  assert.deepEqual(h, ['/*.js', '/*.css', '/fonts/*.woff2', '/models/*.glb']);
});
