import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
test('sitemap.xml lists every public page and nothing else', () => {
  const sm = readFileSync(new URL('sitemap.xml', root), 'utf8');
  const listed = new Set([...sm.matchAll(/<loc>https:\/\/birdbird\.eu\/([^<]*)<\/loc>/g)].map(m => m[1] || 'index.html'));
  for (const f of readdirSync(root).filter(f => f.endsWith('.html') && f !== '404.html')) {
    const noindex = /name="robots" content="[^"]*noindex/.test(readFileSync(new URL(f, root), 'utf8'));
    assert.equal(listed.has(f), !noindex, f + (noindex ? ' is noindex but listed' : ' is missing from sitemap.xml (add it to sitemap.xml)'));
  }
});
