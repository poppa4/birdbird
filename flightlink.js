/* Birdbird – one flight across Route Explorer, the briefing pack and My Workspace.
   Pure helpers, no DOM. Data stays where it was:
     route  (NSTORE 'route')  { id, pts:[{n,t,la,lo}], rt, packId? }
     pack   (NSTORE 'prep')   { id, f:{depapt,destapt,alt1apt,date,type,reg,route}, xs:{route}, routeId? }
   The link is stored both ways: pack.routeId (older packs only have pack.xs.route) and route.packId.
   node --test tests/flightlink.test.mjs */
(function (G) {
  'use strict';
  const str = v => String(v == null ? '' : v).trim();
  const isRwy = p => p && p.t === 'rwy';

  /* departure, destination, alternate and route text from a route */
  function routeSummary(r) {
    const pts = (r && r.pts) || [];
    const main = pts.filter(p => p && !['missed', 'alt'].includes(p.t));
    const first = main[0], last = main.length > 1 ? main[main.length - 1] : null;
    const dep = isRwy(first) ? str(first.n) : '';
    let dest = ''; for (let i = main.length - 1; i > 0; i--) if (isRwy(main[i])) { dest = str(main[i].n); break; }
    if (!dest && last && isRwy(last)) dest = str(last.n);
    const altP = pts.find(p => p && p.t === 'alt');
    const alt = altP ? str(altP.n).split(/\s/)[0] : '';
    const rt = str(r && r.rt) || main.filter(p => !p.auto && !p.app).map(p => str(p.n)).filter(Boolean).join(' DCT ');
    return { dep, dest, alt, rt };
  }

  const packRouteId = p => (p && (p.routeId || (p.xs && p.xs.route))) || '';

  /* the pack that belongs to a route: the one the route points at, else the newest pack that points at the route */
  function packForRoute(packs, r) {
    if (!r) return null; packs = packs || [];
    const own = r.packId && packs.find(p => p && p.id === r.packId);
    if (own && (!packRouteId(own) || packRouteId(own) === r.id)) return own;
    const l = packs.filter(p => p && packRouteId(p) === r.id).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return l[0] || null;
  }
  function routeForPack(routes, p) { const id = packRouteId(p); return id ? (routes || []).find(r => r && r.id === id) || null : null; }

  const today = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* fill the empty fields of a pack from a route and link both ways. Never overwrites what the pilot typed. */
  function prefill(p, r, o) {
    o = o || {}; p.f = p.f || {}; const f = p.f, s = routeSummary(r);
    const set = (k, v) => { if (v && !str(f[k])) f[k] = v; };
    set('depapt', s.dep); set('destapt', s.dest); set('alt1apt', s.alt); set('route', s.rt);
    set('date', o.date || today(o.now ? new Date(o.now) : null));
    if (o.ac) { set('type', str(o.ac.type)); set('reg', str(o.ac.reg)); }
    link(p, r);
    if (!str(p.title)) p.title = [f.depapt, f.destapt].filter(Boolean).join(' – ');
    return p;
  }
  function link(p, r) { if (!p || !r) return false; const ch = p.routeId !== r.id || r.packId !== p.id; p.routeId = r.id; p.xs = p.xs || {}; if (!p.xs.route) p.xs.route = r.id; r.packId = p.id; return ch; }
  function unlink(p, r) { if (p) { delete p.routeId; if (p.xs && r && p.xs.route === r.id) delete p.xs.route; } if (r && p && r.packId === p.id) delete r.packId; }

  /* which sim to fly. The sims have one training airport, so this is practice of the procedure, not the destination. */
  const SIMS = [
    { k: 'da42', re: /\bda\s*-?\s*42|twin\s*star/i, href: 'cockpit.html?s=air&p=ils', en: 'DA42', no: 'DA42' },
    { k: 'c172', re: /\bc(essna)?\s*-?\s*172|skyhawk/i, href: 'c172.html?s=air&p=ils', en: 'C172', no: 'C172' },
    { k: 'b200', re: /\bb\s*-?\s*200|king\s*air|\bbe\s*20\b/i, href: 'b200.html?s=air&p=ils', en: 'King Air B200', no: 'King Air B200' }
  ];
  function simFor(type, typeKey) {
    let s = typeKey && SIMS.find(x => x.k === typeKey);
    if (!s) s = SIMS.find(x => x.re.test(str(type)));
    const fall = !s; s = s || SIMS[0];
    return { k: s.k, href: s.href, guess: fall,
      en: `Practise an ILS in the ${s.en} sim (training airport)`, no: `Øv på en ILS i ${s.no}-simulatoren (treningsflyplass)` };
  }

  /* the compact flight header for a pack */
  function header(p) {
    const f = (p && p.f) || {};
    return { dep: str(f.depapt), dest: str(f.destapt), alt: str(f.alt1apt || f.altn), date: str(f.date), ac: [str(f.type), str(f.reg)].filter(Boolean).join(' '), route: str(f.route) };
  }

  /* a workspace aircraft for the pack: registration first, then a type that only one of your aircraft has */
  function matchAircraft(p, list, typeName) {
    const f = (p && p.f) || {}, nr = s => str(s).toUpperCase().replace(/[\s-]/g, ''), nt = s => str(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    list = list || [];
    const r = nr(f.reg); if (r) { const a = list.find(x => nr(x.reg) === r); if (a) return a; }
    const t = nt(f.type); if (!t) return null;
    const m = list.filter(x => { const a = nt(x.type), b = nt(typeName ? typeName(x) : ''); return (a && a === t) || (b && b === t); });
    return m.length === 1 ? m[0] : null;
  }

  /* My Workspace: open these on the desk */
  function deskHref(items) { const v = (items || []).filter(x => x && x[0] && x[1]).map(x => x[0] + ':' + encodeURIComponent(x[1])).join(','); return 'workspace.html#/desk' + (v ? '?open=' + v : ''); }
  function parseOpen(s) { return str(s).split(',').map(x => { const i = x.indexOf(':'); if (i < 1) return null; let r = x.slice(i + 1); try { r = decodeURIComponent(r); } catch (e) {} return [x.slice(0, i), r]; }).filter(x => x && ['pack', 'route'].includes(x[0]) && x[1]).slice(0, 4); }

  /* a small map line for a route, as an SVG path in a w×h box (equirectangular, north up) */
  function thumb(r, w, h, pad) {
    w = w || 120; h = h || 72; pad = pad == null ? 6 : pad;
    const P = ((r && r.pts) || []).filter(p => p && Number.isFinite(+p.la) && Number.isFinite(+p.lo) && !['missed'].includes(p.t));
    if (P.length < 2) return null;
    let a0 = Infinity, a1 = -Infinity, o0 = Infinity, o1 = -Infinity; P.forEach(p => { a0 = Math.min(a0, +p.la); a1 = Math.max(a1, +p.la); o0 = Math.min(o0, +p.lo); o1 = Math.max(o1, +p.lo); });
    const k = Math.cos((a0 + a1) / 2 * Math.PI / 180) || 1, sx = Math.max(1e-6, (o1 - o0) * k), sy = Math.max(1e-6, a1 - a0);
    const s = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy), cx = w / 2, cy = h / 2, mo = (o0 + o1) / 2, ma = (a0 + a1) / 2;
    const xy = p => [Math.round((cx + ((+p.lo) - mo) * k * s) * 10) / 10, Math.round((cy - ((+p.la) - ma) * s) * 10) / 10];
    const main = P.filter(p => p.t !== 'alt'), alt = P.filter(p => p.t === 'alt');
    const d = main.map((p, i) => (i ? 'L' : 'M') + xy(p).join(' ')).join('');
    const dA = alt.length && main.length ? 'M' + xy(main[main.length - 1]).join(' ') + alt.map(p => 'L' + xy(p).join(' ')).join('') : '';
    return { d, dA, a: xy(main[0] || P[0]), b: xy(main[main.length - 1] || P[P.length - 1]) };
  }

  const API = { routeSummary, packRouteId, packForRoute, routeForPack, prefill, link, unlink, simFor, header, matchAircraft, deskHref, parseOpen, thumb, today, SIMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  G.FLIGHT = API;
})(typeof window !== 'undefined' ? window : globalThis);
