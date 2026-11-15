/* Birdbird – offline for the ground briefing. Registered by the briefing pack and Route Explorer.
   Pages you have opened, their scripts and data, and the last weather you fetched stay usable without a network
   (at the aerodrome, before flight). Online, everything comes fresh from the network first.
   - On install: the briefing pack and Route Explorer pages, every versioned script/style they load, and the airport data.
   - Page navigations and /api weather (wx, sigmet, winds, sigchart): network first, the last good copy when offline.
     Cloudflare serves /route for /route.html, so a page is looked up under both names.
   - Versioned files (?v=N, never change): cache first. Other same-site files (data/*.json, images): network first.
   - Not touched: other sites (map tiles), sign-in and sync APIs, radar files and satellite tiles (large, live only), non-GET. */
const C = 'bb-off-3';
const SKIP = /^\/api\/(auth|me|sync|atc|radar|sat)\b/;
const API = /^\/api\/(wx|sigmet|winds|sigchart)\b/;
const PAGES = ['/prep', '/route'], DATA = ['/data/nav-eu.json', '/data/fixes-nordic.json'];
const clean = async r => new Response(await r.blob(), { status: 200, headers: r.headers }); // drops the 'redirected' flag a navigation may not use
async function precache() {
  const c = await caches.open(C);
  for (const p of PAGES) {
    try { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) continue; const html = await r.clone().text();
      const keep = await clean(r); await c.put(p, keep.clone()); await c.put(p + '.html', keep);
      const refs = [...html.matchAll(/(?:src|href)="([^"#]+\?v=[^"#]+)"/g)].map(m => new URL(m[1], self.location.origin + '/').href).filter(u => u.startsWith(self.location.origin));
      await Promise.all(refs.map(u => c.match(u).then(h => h || fetch(u).then(x => x.ok ? c.put(u, x) : null)).catch(() => {}))); } catch (e) {}
  }
  await Promise.all(DATA.map(u => fetch(u).then(x => x.ok ? c.put(u, x) : null).catch(() => {})));
}
self.addEventListener('install', e => { e.waitUntil(precache()); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bb-off-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const alt = p => p.endsWith('.html') ? p.slice(0, -5) : p + '.html';
async function netFirst(req) {
  const c = await caches.open(C);
  try { const r = await fetch(req); if (r.ok && !r.redirected && r.type === 'basic') c.put(req, r.clone()).catch(() => {}); return r; }
  catch (e) { let hit = await c.match(req, { ignoreVary: true });
    if (!hit && req.mode === 'navigate') { const p = new URL(req.url).pathname; hit = await c.match(p, { ignoreSearch: true }) || await c.match(alt(p), { ignoreSearch: true }); }
    if (hit) return hit; throw e; }
}
async function cacheFirst(req) {
  const c = await caches.open(C); const hit = await c.match(req); if (hit) return hit;
  const r = await fetch(req); if (r.ok && r.type === 'basic') c.put(req, r.clone()).catch(() => {}); return r;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== self.location.origin || SKIP.test(u.pathname)) return;
  if (u.pathname.startsWith('/api/')) { if (API.test(u.pathname)) e.respondWith(netFirst(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(netFirst(req)); return; }
  if (/[?&]v=/.test(u.search)) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(netFirst(req));
});
