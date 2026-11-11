/* Birdbird – accounts and sync (client). Loaded on every page by site.js.
   Passkey sign-in against /api/auth/*, and sync of the browser's own Birdbird data (localStorage) to /api/sync,
   grouped in four namespaces. Without the backend (static server, the old Claude artifact) everything stays local.

   Sync rules
   - On sign-in, on page load when signed in (at most every 30 s), and after changes (debounced, at most every 5 s).
   - Per namespace: only one side changed since the last sync -> that side wins as a whole (deletions carry over).
     Both changed -> newest wins per namespace, but best scores, the newest copy of each briefing pack, route,
     map note and aircraft, and both briefing histories are kept (so a concurrent edit does not lose anything).
   - The server is empty -> this device's data is uploaded. First sign-in on a device that has its own data and
     the account also has data -> the user chooses: keep this device's data, use the account's, or combine.
   - Not synced: uploaded documents and attachments (IndexedDB), API keys for map layers, per-device switches. */
(function (G) {
  'use strict';
  if (G.BBACCOUNT) return;
  const API = '/api';
  const META = 'birdbird-account';
  const PULL_EVERY = 30e3, PUSH_GAP = 5e3, PUSH_DEBOUNCE = 1200;

  /* ---------- which keys belong to which namespace ---------- */
  const NAMES = ['progress', 'packs', 'routes', 'settings'];
  const SETTINGS = ['vlab-lang', 'vlab-reg', 'bb-b200-deck', 'naeroson-prep-view', 'naeroson-route-mode', 'bb-rx-v3', 'bb-rx-simspd'];
  const PROGRESS = ['naeroson-prog', 'bb-track', 'naeroson-store-fises', 'naeroson-brief-hist', 'naeroson-g2g', 'bb-debrief'];
  const PACKS = ['naeroson-store-prep', 'naeroson-store-aircraft', 'naeroson-store-fiac', 'aeroson-fpl', 'aeroson-nav'];
  const ROUTES = ['naeroson-store-route', 'naeroson-store-fixes', 'naeroson-store-mapview', 'naeroson-store-mapnote'];
  function nsOf(k) {
    if (!k) return null;
    if (SETTINGS.includes(k)) return 'settings';
    if (PROGRESS.includes(k) || /^(aeroson-quiz-|naeroson-radio-|vlab-done-|bb-b200-)/.test(k)) return 'progress';
    if (PACKS.includes(k)) return 'packs';
    if (ROUTES.includes(k)) return 'routes';
    return null;
  }

  /* ---------- small helpers ---------- */
  const lang = () => document.documentElement.lang === 'nb' ? 'no' : 'en';
  const L = o => (o && typeof o === 'object') ? (o[lang()] || o.en) : String(o);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let LS = null; try { LS = G.localStorage; LS.getItem('x'); } catch (e) { LS = null; }
  const rawSet = LS ? Storage.prototype.setItem : null, rawRem = LS ? Storage.prototype.removeItem : null;
  let applying = 0;
  const lsKeys = () => { const o = []; if (!LS) return o; try { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k != null) o.push(k); } } catch (e) {} return o; };
  function collect(ns) { const o = {}; lsKeys().filter(k => nsOf(k) === ns).sort().forEach(k => { try { o[k] = LS.getItem(k); } catch (e) {} }); return o; }
  const stable = o => JSON.stringify(Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {}));
  function hash(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
  const hOf = o => hash(stable(o));
  const empty = o => !o || Object.keys(o).length === 0;
  function readMeta() { try { const m = JSON.parse(LS.getItem(META) || 'null'); if (m && typeof m === 'object') { m.ns = m.ns || {}; return m; } } catch (e) {} return { uid: null, signedIn: false, user: null, ns: {}, last: 0 }; }
  let meta = LS ? readMeta() : { ns: {} };
  function saveMeta() { if (!LS) return; try { applying++; rawSet.call(LS, META, JSON.stringify(meta)); } catch (e) {} finally { applying--; } }
  const nsm = n => (meta.ns[n] = meta.ns[n] || { v: 0, h: null, at: 0 });
  const isDirty = n => { const m = nsm(n); return hOf(collect(n)) !== m.h; };

  /* ---------- state ---------- */
  const A = {
    backend: 'unknown',        // unknown | ok | off (no database yet) | none (no Functions: localhost, Claude artifact)
    user: meta.signedIn ? meta.user : null,
    me: null,                  // last /api/me body when signed in
    sync: { state: 'idle', last: meta.last || 0, error: null },
    supported: !!(G.PublicKeyCredential && navigator.credentials && navigator.credentials.create),
    platform: null,            // true/false once known: a built-in passkey authenticator (Face ID, Touch ID, Windows Hello)
    namespaces: NAMES.slice(), nsOf, L
  };
  const fire = (name, detail) => { try { const e = new CustomEvent(name, { detail, cancelable: true }); document.dispatchEvent(e); return e; } catch (e) { return null; } };
  const changed = () => { decorate(); fire('bb-account', { state: A }); };

  /* ---------- http ---------- */
  async function api(method, path, body, opts) {
    opts = opts || {};
    let r;
    try {
      r = await fetch(API + path, { method, credentials: 'same-origin', cache: 'no-store', keepalive: !!opts.keepalive, headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { const er = new Error(L({ en: 'No connection. Check your internet connection and try again.', no: 'Ingen forbindelse. Sjekk internettforbindelsen og prøv igjen.' })); er.code = 'offline'; er.status = 0; throw er; }
    let j = null; const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) { try { j = await r.json(); } catch (e) {} }
    if (!j || typeof j.ok !== 'boolean') { const er = new Error(L({ en: 'Accounts are available on birdbird.eu.', no: 'Kontoer er tilgjengelige på birdbird.eu.' })); er.code = 'no_backend'; er.status = r.status; throw er; }
    if (!r.ok || !j.ok) { const er = new Error(msgFor(j) || ('HTTP ' + r.status)); er.code = j.error; er.status = r.status; er.body = j; er.retryAfter = +r.headers.get('retry-after') || 0; throw er; }
    return j;
  }
  /* server messages are English; give the Norwegian version for the common ones */
  const NO_MSG = {
    signed_out: 'Du er logget ut. Logg inn med passnøkkelen din og prøv igjen.',
    rate_limited: 'For mange forsøk. Vent litt og prøv igjen.',
    bad_code: 'Gjenopprettingskoden stemmer ikke med noen konto. Sjekk for skrivefeil, eller bruk den nyeste koden hvis du har laget en ny.',
    unknown_passkey: 'Denne passnøkkelen er ikke koblet til en Birdbird-konto lenger. Logg inn med gjenopprettingskoden, eller lag en ny konto. Den gamle passnøkkelen kan du slette i passordinnstillingene på enheten.',
    expired: 'Forespørselen gikk ut på tid eller ble allerede brukt. Start på nytt.',
    exists: 'Denne passnøkkelen er allerede koblet til en Birdbird-konto. Bruk «Logg inn» i stedet.',
    last_passkey: 'Dette er den eneste passnøkkelen din. Legg til en passnøkkel på en annen enhet først, og fjern så denne.',
    too_large: 'Dataene er over 1,5 MB, for store til å synkroniseres. Slett gamle briefingpakker eller ruter og prøv igjen.',
    no_db: 'Kontoer er ikke slått på for dette nettstedet ennå. Alt fungerer fortsatt og lagres i denne nettleseren.',
    bad_origin: 'Forespørselen kom ikke fra Birdbird selv. Last inn siden på nytt og prøv igjen.',
    server: 'Noe gikk galt hos oss. Dataene dine er fortsatt lagret i denne nettleseren. Prøv igjen om et minutt.',
    insecure: 'Passnøkler krever en sikker (https) forbindelse. Åpne Birdbird på https://birdbird.eu.'
  };
  const msgFor = j => j ? (lang() === 'no' && NO_MSG[j.error] ? NO_MSG[j.error] + (j.error === 'rate_limited' && j.retryAfter ? ' (' + j.retryAfter + ' s)' : '') : j.message) : '';

  /* ---------- WebAuthn in the browser ---------- */
  const b64u = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const toCreate = o => Object.assign({}, o, { challenge: unb64u(o.challenge), user: Object.assign({}, o.user, { id: unb64u(o.user.id) }), excludeCredentials: (o.excludeCredentials || []).map(c => Object.assign({}, c, { id: unb64u(c.id) })) });
  const toGet = o => Object.assign({}, o, { challenge: unb64u(o.challenge), allowCredentials: (o.allowCredentials || []).map(c => Object.assign({}, c, { id: unb64u(c.id) })) });
  function credToJSON(c) {
    const r = c.response, out = { id: c.id, rawId: b64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || null, clientExtensionResults: {}, response: { clientDataJSON: b64u(r.clientDataJSON) } };
    if (r.attestationObject) { out.response.attestationObject = b64u(r.attestationObject); try { out.response.transports = r.getTransports ? r.getTransports() : []; } catch (e) { out.response.transports = []; } }
    if (r.authenticatorData) { out.response.authenticatorData = b64u(r.authenticatorData); out.response.signature = b64u(r.signature); out.response.userHandle = r.userHandle ? b64u(r.userHandle) : null; }
    return out;
  }
  function passkeyError(e, mode) {
    const n = e && e.name;
    const m = n === 'NotAllowedError' ? { en: 'The passkey request was cancelled or timed out. Try again when you are ready.', no: 'Passnøkkelforespørselen ble avbrutt eller gikk ut på tid. Prøv igjen når du er klar.' }
      : n === 'InvalidStateError' ? (mode === 'create' ? { en: 'This device already has a passkey for your Birdbird account. Sign in with it instead.', no: 'Denne enheten har allerede en passnøkkel for Birdbird-kontoen din. Logg inn med den i stedet.' } : { en: 'The passkey could not be used. Try again.', no: 'Passnøkkelen kunne ikke brukes. Prøv igjen.' })
      : n === 'SecurityError' ? { en: 'Passkeys only work on https://birdbird.eu (or localhost). Open Birdbird there and try again.', no: 'Passnøkler virker bare på https://birdbird.eu (eller localhost). Åpne Birdbird der og prøv igjen.' }
      : n === 'NotSupportedError' ? { en: 'This device cannot make a suitable passkey. Try your phone, or another browser.', no: 'Denne enheten kan ikke lage en passende passnøkkel. Prøv telefonen eller en annen nettleser.' }
      : n === 'AbortError' ? { en: 'The passkey request was stopped. Try again.', no: 'Passnøkkelforespørselen ble stoppet. Prøv igjen.' }
      : null;
    if (!m) return e;
    const er = new Error(L(m)); er.code = 'passkey_' + n; return er;
  }
  function needPasskeys() {
    if (!A.supported) { const e = new Error(L({ en: 'This browser cannot use passkeys. Update it, use another browser, or sign in with your recovery code.', no: 'Denne nettleseren kan ikke bruke passnøkler. Oppdater den, bruk en annen nettleser, eller logg inn med gjenopprettingskoden.' })); e.code = 'unsupported'; throw e; }
  }

  async function signup(name) {
    needPasskeys();
    const o = await api('POST', '/auth/register/options', { name: name || '' });
    let c; try { c = await navigator.credentials.create({ publicKey: toCreate(o.options) }); } catch (e) { throw passkeyError(e, 'create'); }
    const v = await api('POST', '/auth/register/verify', { credential: credToJSON(c) });
    await signedIn(v.user);
    await syncNow({ first: true });
    refreshMe().catch(() => {});
    return v; // v.recoveryCode is shown once
  }
  async function addPasskey() {
    needPasskeys();
    const o = await api('POST', '/auth/register/options', {});
    let c; try { c = await navigator.credentials.create({ publicKey: toCreate(o.options) }); } catch (e) { throw passkeyError(e, 'create'); }
    const v = await api('POST', '/auth/register/verify', { credential: credToJSON(c) });
    await refreshMe();
    return v;
  }
  async function login() {
    needPasskeys();
    const o = await api('POST', '/auth/login/options', {});
    let c; try { c = await navigator.credentials.get({ publicKey: toGet(o.options), mediation: 'optional' }); } catch (e) { throw passkeyError(e, 'get'); }
    const v = await api('POST', '/auth/login/verify', { credential: credToJSON(c) });
    await signedIn(v.user);
    await syncNow({ first: true });
    refreshMe().catch(() => {});
    return v;
  }
  async function recovery(code) {
    const v = await api('POST', '/auth/recovery', { code: String(code || '') });
    await signedIn(v.user);
    await syncNow({ first: true });
    refreshMe().catch(() => {});
    return v; // v.recoveryCode: the new code, v.passkeys: how many the account has
  }
  async function newRecoveryCode() { const v = await api('POST', '/me/recovery', {}); await refreshMe(); return v; }
  async function removePasskey(id) { const v = await api('DELETE', '/me/credentials?id=' + encodeURIComponent(id), {}); await refreshMe(); return v; }
  async function rename(name) { const v = await api('PATCH', '/me', { name }); A.user = v.user; meta.user = v.user; saveMeta(); await refreshMe(); return v; }
  async function logout() {
    try { await flush(); } catch (e) {}
    try { await api('POST', '/auth/logout', {}); } catch (e) { if (e.code !== 'signed_out') throw e; }
    signedOut();
  }
  async function deleteAccount() {
    await api('DELETE', '/me', { confirm: 'delete' });
    meta = { uid: null, signedIn: false, user: null, ns: {}, last: 0 }; saveMeta();
    A.user = null; A.me = null; A.sync = { state: 'idle', last: 0, error: null }; changed();
  }
  /* sign out and forget this device's link to the account, so that clearing local data is not synced as a deletion */
  async function forgetDevice() {
    clearTimeout(pushT); pushT = 0;
    if (A.user) { try { await api('POST', '/auth/logout', {}); } catch (e) {} }
    meta = { uid: null, signedIn: false, user: null, ns: {}, last: 0 }; saveMeta();
    A.user = null; A.me = null; A.sync = { state: 'idle', last: 0, error: null }; changed();
  }
  /* remove the synced Birdbird data from this browser without syncing the removal (used after deleting the account) */
  function wipeLocal() { applying++; try { lsKeys().filter(k => nsOf(k)).forEach(k => rawRem.call(LS, k)); } finally { applying--; } try { document.dispatchEvent(new CustomEvent('nprog')); } catch (e) {} }
  async function signedIn(user) { A.backend = 'ok'; A.user = user || { id: null }; meta.signedIn = true; meta.user = A.user; saveMeta(); changed(); await refreshMe(); }
  function signedOut() { A.user = null; A.me = null; meta.signedIn = false; meta.user = null; saveMeta(); clearTimeout(pushT); A.sync = { state: 'idle', last: meta.last || 0, error: null }; changed(); }
  async function refreshMe() {
    try {
      const j = await api('GET', '/me'); A.backend = 'ok';
      if (!j.user) { signedOut(); return j; }
      A.me = j; A.user = j.user; meta.user = j.user; meta.signedIn = true; saveMeta(); changed(); return j;
    }
    catch (e) { if (e.code === 'signed_out') { A.backend = 'ok'; signedOut(); } else if (e.code === 'no_db') { A.backend = 'off'; changed(); } else if (e.code === 'no_backend') { A.backend = 'none'; changed(); } throw e; }
  }
  /* detect the backend without signing in (used by profile.html; other pages only call the API when signed in) */
  /* a plain static server on this machine (python -m http.server, npx serve) has no Functions: do not probe it.
     wrangler pages dev (port 8788) does, so it is probed like birdbird.eu and pages.dev previews. */
  const staticLocal = location.protocol === 'file:' || (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && location.port !== '8788');
  async function detect() {
    if (staticLocal && !A.user) { A.backend = 'none'; changed(); return A.backend; }
    try { await refreshMe(); } catch (e) {}
    if (A.backend === 'unknown') A.backend = 'none';
    changed(); return A.backend;
  }

  /* ---------- merge ---------- */
  const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
  const pj = v => { try { return JSON.parse(v); } catch (e) { return null; } };
  function mergeKey(k, a, b) { // a = newer side's value, b = older side's value; both present
    if (a === b) return a;
    if (/^(aeroson-quiz-|naeroson-radio-|vlab-done-)/.test(k)) return String(Math.max(num(a), num(b)));
    const A1 = pj(a), B1 = pj(b);
    if (!A1 || !B1 || typeof A1 !== 'object' || typeof B1 !== 'object') return a;
    if (k === 'naeroson-prog') { const o = Object.assign({}, B1, A1); for (const x in B1) o[x] = Math.max(num(A1[x]), num(B1[x])); return JSON.stringify(o); }
    if (/^naeroson-store-/.test(k)) { const o = Object.assign({}, B1); for (const id in A1) { if (!o[id] || ((A1[id] && A1[id].updated) || 0) >= ((o[id] && o[id].updated) || 0)) o[id] = A1[id]; } return JSON.stringify(o); }
    if (k === 'bb-b200-stats') { const o = Object.assign({}, B1); for (const id in A1) { if (!o[id] || ((A1[id] && A1[id].t) || 0) >= ((o[id] && o[id].t) || 0)) o[id] = A1[id]; } return JSON.stringify(o); }
    if (k === 'bb-b200-leitner') return JSON.stringify(Object.assign({}, B1, A1));
    if (k === 'bb-debrief' && Array.isArray(A1) && Array.isArray(B1)) { const seen = new Set(); return JSON.stringify(B1.concat(A1).filter(x => { const id = x && x.id; if (!id || seen.has(id)) return false; seen.add(id); return true; }).sort((x, y) => (x.at || 0) - (y.at || 0)).slice(-30)); }
    if (k === 'naeroson-brief-hist' && Array.isArray(A1) && Array.isArray(B1)) { const seen = new Set(); return JSON.stringify(B1.concat(A1).filter(x => { const id = x && (x.k + ':' + x.t); if (seen.has(id)) return false; seen.add(id); return true; }).sort((x, y) => (x.t || 0) - (y.t || 0)).slice(-40)); }
    return a;
  }
  function merge(local, localAt, server, serverAt) {
    const localNewer = (localAt || 0) >= (serverAt || 0);
    const newer = localNewer ? local : server, older = localNewer ? server : local;
    const out = Object.assign({}, older, newer);
    for (const k in newer) if (k in older) out[k] = mergeKey(k, newer[k], older[k]);
    return out;
  }
  A._merge = merge;

  /* ---------- apply server data to this browser ---------- */
  function apply(ns, data) {
    const cur = collect(ns);
    applying++;
    try {
      for (const k in cur) if (!(k in data)) rawRem.call(LS, k);
      for (const k in data) if (nsOf(k) === ns && typeof data[k] === 'string' && cur[k] !== data[k]) rawSet.call(LS, k, data[k]);
    } catch (e) { /* storage full: keep going, the next sync retries */ }
    finally { applying--; }
    return stable(cur) !== stable(collect(ns));
  }
  let appliedNow = [];
  function afterApply() {
    if (!appliedNow.length) return;
    const list = appliedNow; appliedNow = [];
    try { document.dispatchEvent(new CustomEvent('nprog')); } catch (e) {}
    const e = fire('bb-account-sync', { applied: list });
    if (e && e.defaultPrevented) return;
    if (list.every(n => n === 'settings')) return;
    toast(L({ en: 'Updated from your account', no: 'Oppdatert fra kontoen din' }), L({ en: 'Newer data from another device was loaded. Reload to see it.', no: 'Nyere data fra en annen enhet ble lastet inn. Last inn siden på nytt for å se dem.' }), L({ en: 'Reload', no: 'Last inn på nytt' }), () => location.reload());
  }

  /* ---------- sync ---------- */
  let syncing = null, pushT = 0, lastPush = 0, pendingNs = new Set();
  function setSync(state, error) { A.sync = { state, last: A.sync.last, error: error || null }; if (state === 'idle' && !error) { A.sync.last = meta.last = Date.now(); saveMeta(); } changed(); }

  async function pushNs(n, force) {
    for (let tries = 0; tries < 3; tries++) {
      const m = nsm(n), data = collect(n);
      try {
        const r = await api('PUT', '/sync', { ns: n, data, baseVersion: m.v || 0, updatedAt: m.at || Date.now(), force: !!force });
        m.v = r.version; m.h = hOf(data); m.at = 0; saveMeta(); return;
      } catch (e) {
        if (e.code !== 'conflict' || !e.body || !e.body.current) throw e;
        const cur = e.body.current;
        const merged = merge(data, m.at || Date.now(), cur.data || {}, cur.updatedAt || 0);
        if (apply(n, merged)) appliedNow.push(n);
        m.v = cur.version; m.at = Math.max(m.at || 0, cur.updatedAt || 0, Date.now()); saveMeta();
      }
    }
    throw Object.assign(new Error(L({ en: 'Another device keeps saving at the same time. Sync will try again shortly.', no: 'En annen enhet lagrer samtidig. Synkroniseringen prøver igjen om litt.' })), { code: 'busy' });
  }

  /* opts.first: right after signing in on this device; opts.choice: 'device' | 'account' | 'combine' */
  async function syncNow(opts) {
    opts = opts || {};
    if (!A.user || !LS) return;
    if (syncing) { await syncing.catch(() => {}); if (!opts.first && !opts.choice) return; }
    syncing = (async () => {
      setSync('syncing');
      const res = await api('GET', '/sync');
      const S = res.ns || {};
      const uid = A.user && A.user.id;
      const newDevice = !!uid && meta.uid !== uid;
      if (newDevice && !opts.choice) {
        const clash = NAMES.filter(n => { const l = collect(n), s = S[n]; return !empty(l) && s && !empty(s.data) && stable(l) !== stable(s.data); });
        if (clash.filter(n => n !== 'settings').length) { setSync('choice'); const choice = await askChoice(clash); syncing = null; return syncNow({ choice }); }
      }
      if (newDevice) { NAMES.forEach(n => { meta.ns[n] = { v: 0, h: null, at: Date.now() }; }); }
      for (const n of NAMES) {
        const m = nsm(n), local = collect(n), s = S[n], dirty = hOf(local) !== m.h;
        if (opts.choice === 'device' && newDevice) { if (!empty(local)) { m.v = s ? s.version : 0; await pushNs(n, true); } else if (s) { if (apply(n, s.data || {})) appliedNow.push(n); m.v = s.version; m.h = hOf(collect(n)); m.at = 0; } continue; }
        if (opts.choice === 'account' && newDevice) { if (s && !empty(s.data)) { if (apply(n, s.data)) appliedNow.push(n); m.v = s.version; m.h = hOf(collect(n)); m.at = 0; } else if (!empty(local)) { m.v = s ? s.version : 0; await pushNs(n, true); } continue; }
        if (!s || (newDevice && empty(s.data))) { // nothing on the server yet: keep (and upload) this device's data
          if (!empty(local)) { m.v = s ? s.version : 0; await pushNs(n); } else { m.v = s ? s.version : 0; m.h = hOf(local); m.at = 0; }
          continue;
        }
        if (s.version === m.v && !newDevice) { if (dirty) await pushNs(n); continue; }
        if (!dirty && !newDevice) { if (apply(n, s.data || {})) appliedNow.push(n); m.v = s.version; m.h = hOf(collect(n)); m.at = 0; saveMeta(); continue; }
        // both sides changed (or a new device combining): merge, store locally, push
        const merged = empty(local) ? (s.data || {}) : merge(local, m.at || 0, s.data || {}, s.updatedAt || 0);
        if (apply(n, merged)) appliedNow.push(n);
        m.v = s.version;
        if (stable(collect(n)) !== stable(s.data || {})) { m.at = Math.max(Date.now(), (s.updatedAt || 0) + 1); await pushNs(n); }
        else { m.h = hOf(collect(n)); m.at = 0; }
      }
      meta.uid = uid; saveMeta();
      setSync('idle');
      afterApply();
    })();
    try { await syncing; }
    catch (e) {
      if (e.code === 'signed_out') signedOut();
      else if (e.code === 'no_backend') { A.backend = 'none'; setSync('error', e.message); }
      else if (e.code === 'no_db') { A.backend = 'off'; setSync('error', e.message); }
      else { setSync(e.code === 'offline' ? 'offline' : 'error', e.message); if (e.code === 'rate_limited' || e.code === 'busy') schedulePush(null, (e.retryAfter || 10) * 1000); }
      afterApply();
    }
    finally { syncing = null; }
  }

  /* local change -> remember when, push soon (debounced, max every 5 s) */
  function noteChange(k) {
    const n = nsOf(k); if (!n || applying) return;
    const m = nsm(n); if (!m.at) { m.at = Date.now(); saveMeta(); }
    if (A.user) schedulePush(n);
  }
  function schedulePush(n, wait) {
    if (n) pendingNs.add(n);
    clearTimeout(pushT);
    const gap = Math.max(wait || PUSH_DEBOUNCE, lastPush + PUSH_GAP - Date.now());
    pushT = setTimeout(runPush, gap);
  }
  async function runPush() {
    pushT = 0;
    if (!A.user) return;
    if (syncing) { schedulePush(null, 1000); return; }
    const list = NAMES.filter(n => pendingNs.has(n) || isDirty(n)); pendingNs.clear();
    if (!list.length) return;
    lastPush = Date.now();
    syncing = (async () => { setSync('syncing'); for (const n of list) if (isDirty(n)) await pushNs(n); setSync('idle'); afterApply(); })();
    try { await syncing; } catch (e) { if (e.code === 'signed_out') signedOut(); else { setSync(e.code === 'offline' ? 'offline' : 'error', e.message); if (e.code !== 'too_large') schedulePush(null, Math.max(10e3, (e.retryAfter || 0) * 1000)); } afterApply(); }
    finally { syncing = null; }
  }
  async function flush() { if (pushT) { clearTimeout(pushT); await runPush(); } }
  /* leaving the page: send what is small enough with keepalive; the rest goes on the next page load */
  function flushOnHide() {
    if (!A.user || !pushT) return;
    clearTimeout(pushT); pushT = 0;
    NAMES.forEach(n => { if (!isDirty(n)) return; const m = nsm(n), data = collect(n), body = JSON.stringify({ ns: n, data, baseVersion: m.v || 0, updatedAt: m.at || Date.now() });
      if (body.length < 60000) try { fetch(API + '/sync', { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.ok) { m.v = j.version; m.h = hOf(data); m.at = 0; saveMeta(); } }).catch(() => {}); } catch (e) {} });
  }

  /* watch this tab's own writes (storage events only fire in other tabs) */
  if (LS) {
    try {
      Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === LS) noteChange(String(k)); };
      Storage.prototype.removeItem = function (k) { rawRem.call(this, k); if (this === LS) noteChange(String(k)); };
    } catch (e) {}
    G.addEventListener('storage', e => {
      if (e.storageArea !== LS) return;
      if (e.key === META) { const m = readMeta(); const was = !!A.user; meta = m; A.user = m.signedIn ? m.user : null; if (was !== !!A.user) changed(); return; }
      if (e.key === null) { NAMES.forEach(n => noteChange(n === 'settings' ? 'vlab-lang' : n === 'progress' ? 'naeroson-prog' : n === 'packs' ? 'naeroson-store-prep' : 'naeroson-store-route')); return; }
      if (nsOf(e.key) && A.user) schedulePush(nsOf(e.key)); // the other tab already noted the time
    });
    G.addEventListener('pagehide', flushOnHide);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnHide(); else if (A.user && Date.now() - (meta.last || 0) > PULL_EVERY) syncNow(); });
    G.addEventListener('online', () => { if (A.user) syncNow(); });
  }

  /* ---------- UI: header state, toast, first-sign-in choice ---------- */
  function css() {
    if (document.getElementById('bbacct-css')) return;
    const s = document.createElement('style'); s.id = 'bbacct-css';
    s.textContent = `
.site .mytr[data-acct],.site nav a.mob[data-acct]{position:relative}
.site .mytr[data-acct]::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 8px 1px 0;vertical-align:middle;background:var(--ok,#2E7D4F)}
.site .mytr[data-acct=sync]::before{background:var(--info,#1D4E9E)}
.site .mytr[data-acct=err]::before{background:var(--caution,#B7791F)}
.site nav a.mob[data-acct]::after{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:8px;vertical-align:middle;background:var(--ok,#2E7D4F)}
.site nav a.mob[data-acct=err]::after{background:var(--caution,#B7791F)}
.bbacct-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:120;max-width:min(440px,calc(100vw - 24px));background:var(--ink,#13202A);color:#fff;border-radius:var(--radius,3px);padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:var(--shadow-pop,0 8px 24px rgba(0,0,0,.2));font-size:14px;line-height:1.4}
.bbacct-toast b{display:block;font-size:14.5px}.bbacct-toast span{color:var(--rule,#C6D0D3);font-size:13px}
.bbacct-toast button{flex:0 0 auto;font:inherit;font-weight:600;font-size:13px;background:#fff;color:var(--ink,#13202A);border:0;border-radius:var(--radius,3px);padding:7px 11px;cursor:pointer}
.bbacct-toast button.x{background:transparent;color:#fff;padding:7px 8px}
.bbacct-toast button:focus-visible,.bbacct-dlg button:focus-visible{outline:2px solid var(--info,#1D4E9E);outline-offset:2px}
dialog.bbacct-dlg{border:1px solid var(--rule,#C6D0D3);border-radius:var(--radius-lg,6px);padding:22px;max-width:min(520px,calc(100vw - 24px));width:100%;box-sizing:border-box;background:var(--sheet,#fff);color:var(--ink,#13202A);box-shadow:var(--shadow-pop,0 8px 24px rgba(0,0,0,.2))}
dialog.bbacct-dlg::backdrop{background:rgba(19,32,42,.38)}
.bbacct-dlg h3{font-family:var(--f-display);font-stretch:90%;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.2}
.bbacct-dlg p{margin:0 0 14px;color:var(--ink-2,#4C5B66);font-size:14.5px;line-height:1.5}
.bbacct-dlg .opts{display:flex;flex-direction:column;gap:8px}
.bbacct-dlg .opt{display:block;text-align:left;width:100%;font:inherit;background:var(--sheet,#fff);border:1px solid var(--rule,#C6D0D3);border-radius:var(--radius,3px);padding:12px 14px;cursor:pointer;color:var(--ink,#13202A)}
.bbacct-dlg .opt:hover{border-color:var(--ink,#13202A)}
.bbacct-dlg .opt b{display:block;font-size:15px;margin-bottom:2px}.bbacct-dlg .opt span{display:block;font-size:13.5px;color:var(--ink-2,#4C5B66);line-height:1.4}
.bbacct-dlg .opt.rec{border-color:var(--accent,#9A1E68);box-shadow:inset 3px 0 0 var(--accent,#9A1E68)}
.bbacct-dlg .ns{font-family:var(--f-mono);font-size:12.5px;color:var(--ink,#13202A)}`;
    document.head.appendChild(s);
  }
  let toastEl = null;
  function toast(title, text, btn, onBtn) {
    if (!document.body) return; css();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'bbacct-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = `<div><b>${esc(title)}</b><span>${esc(text)}</span></div>${btn ? `<button type="button" class="go">${esc(btn)}</button>` : ''}<button type="button" class="x" aria-label="${esc(L({ en: 'Close', no: 'Lukk' }))}">✕</button>`;
    toastEl.hidden = false;
    const go = toastEl.querySelector('.go'); if (go) go.onclick = () => { toastEl.hidden = true; onBtn && onBtn(); };
    toastEl.querySelector('.x').onclick = () => { toastEl.hidden = true; };
  }
  A.toast = toast;
  const NSNAME = { progress: { en: 'progress', no: 'progresjon' }, packs: { en: 'briefing packs', no: 'briefingpakker' }, routes: { en: 'routes', no: 'ruter' }, settings: { en: 'settings', no: 'innstillinger' } };
  function askChoice(clash) {
    return new Promise(res => {
      css();
      const d = document.createElement('dialog'); d.className = 'bbacct-dlg'; d.setAttribute('aria-labelledby', 'bbacctChH');
      const what = clash.map(n => L(NSNAME[n])).join(', ');
      d.innerHTML = `<h3 id="bbacctChH">${esc(L({ en: 'This device has its own data', no: 'Denne enheten har egne data' }))}</h3>
        <p>${esc(L({ en: 'Your account already has data, and this browser has different data (', no: 'Kontoen din har allerede data, og denne nettleseren har andre data (' }))}<span class="ns">${esc(what)}</span>${esc(L({ en: '). What should Birdbird do?', no: '). Hva skal Birdbird gjøre?' }))}</p>
        <div class="opts">
          <button type="button" class="opt rec" data-c="combine"><b>${esc(L({ en: 'Combine both', no: 'Slå sammen begge' }))}</b><span>${esc(L({ en: 'Keeps your best scores and every briefing pack and route from both. Recommended.', no: 'Beholder de beste resultatene og alle briefingpakker og ruter fra begge. Anbefalt.' }))}</span></button>
          <button type="button" class="opt" data-c="account"><b>${esc(L({ en: 'Use account data', no: 'Bruk kontodataene' }))}</b><span>${esc(L({ en: 'Replaces the data in this browser with what is saved to your account.', no: 'Erstatter dataene i denne nettleseren med det som er lagret på kontoen.' }))}</span></button>
          <button type="button" class="opt" data-c="device"><b>${esc(L({ en: 'Keep data from this device', no: 'Behold dataene fra denne enheten' }))}</b><span>${esc(L({ en: 'Replaces what is saved to your account with the data in this browser.', no: 'Erstatter det som er lagret på kontoen med dataene i denne nettleseren.' }))}</span></button>
        </div>`;
      document.body.appendChild(d);
      let picked = null;
      d.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { picked = b.dataset.c; d.close(); } });
      d.addEventListener('cancel', e => e.preventDefault()); // a choice is needed before syncing
      d.addEventListener('close', () => { d.remove(); res(picked || 'combine'); });
      if (d.showModal) d.showModal(); else { d.setAttribute('open', ''); }
      const f = d.querySelector('.opt'); if (f) f.focus();
    });
  }

  /* header: "My training" shows the account state */
  function decorate() {
    css();
    document.querySelectorAll('.site .mytr, .site nav a.mob[href^="profile.html"]').forEach(a => {
      if (A.user) {
        const st = A.sync.state === 'syncing' ? 'sync' : (A.sync.state === 'error' || A.sync.state === 'offline') ? 'err' : 'on';
        a.dataset.acct = st;
        const who = A.user.name ? L({ en: 'Signed in as ', no: 'Logget inn som ' }) + A.user.name : L({ en: 'Signed in', no: 'Logget inn' });
        const s2 = st === 'sync' ? L({ en: 'syncing', no: 'synkroniserer' }) : st === 'err' ? L({ en: 'sync paused', no: 'synkronisering satt på pause' }) : L({ en: 'synced', no: 'synkronisert' });
        a.title = who + ' · ' + s2;
        a.setAttribute('aria-label', a.textContent.trim() + ' (' + who + ', ' + s2 + ')');
      } else {
        delete a.dataset.acct; a.removeAttribute('aria-label');
        a.title = A.backend === 'none' || A.backend === 'off' ? '' : L({ en: 'Create an account to keep your progress on all your devices', no: 'Lag en konto for å ha progresjonen på alle enhetene dine' });
      }
    });
  }

  /* ---------- start ---------- */
  A.ready = (async () => {
    if (A.supported && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(v => { A.platform = !!v; changed(); }).catch(() => {});
    }
    const go = () => {
      decorate();
      new MutationObserver(decorate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      const hd = document.querySelector('header.site'); let raf = 0;
      if (hd) new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; decorate(); }); }).observe(hd, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    if (A.user && LS) { if (Date.now() - (meta.last || 0) > PULL_EVERY || NAMES.some(isDirty)) await syncNow(); }
    return A;
  })();

  Object.assign(A, { signup, login, recovery, logout, forgetDevice, wipeLocal, addPasskey, removePasskey, newRecoveryCode, rename, deleteAccount, refreshMe, detect, syncNow, flush, collect });
  G.BBACCOUNT = A;
  fire('bb-account-ready', { state: A });
})(window);
