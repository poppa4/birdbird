/* Birdbird – minimal WebAuthn (passkey) verification for Cloudflare Pages Functions.
   No dependencies: WebCrypto only, so it runs in Workers without a build step.

   What it checks (W3C WebAuthn Level 2, sections 7.1 and 7.2):
   - clientDataJSON: type, challenge (single use, issued by us), origin, not cross-origin
   - authenticatorData: rpIdHash = SHA-256(rpId), User Present and User Verified flags, sign counter
   - registration: credential id matches, public key is ES256 (P-256) or RS256, and imports cleanly
   - authentication: signature over authenticatorData || SHA-256(clientDataJSON) with the stored key
   Attestation: we ask for attestation 'none' and do not use attestation statements to decide trust,
   so attStmt is ignored whatever the format (Safari and Chrome send 'none' for passkeys anyway).
   This is the same trust model as SimpleWebAuthn with attestationType 'none'. */

const te = new TextEncoder();
const td = new TextDecoder();

export const COSE_ES256 = -7;
export const COSE_RS256 = -257;

/* ---------- base64url ---------- */
export function b64u(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(str)) throw new WAError('bad_encoding', 'Not base64url.');
  const s = str.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function randomBytes(n) { const u = new Uint8Array(n); crypto.getRandomValues(u); return u; }
export async function sha256(data) { return new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? te.encode(data) : data)); }
const eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
const concat = (...parts) => { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };

export class WAError extends Error { constructor(code, message) { super(message); this.code = code; } }

/* ---------- CBOR (RFC 8949), just what WebAuthn needs ---------- */
export function cborDecode(buf, start) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = start || 0, depth = 0;
  const need = n => { if (p + n > u.length) throw new WAError('bad_cbor', 'CBOR data is cut short.'); };
  const len = ai => {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return u[p++]; }
    if (ai === 25) { need(2); const v = (u[p] << 8) | u[p + 1]; p += 2; return v; }
    if (ai === 26) { need(4); const v = ((u[p] << 24) >>> 0) + (u[p + 1] << 16) + (u[p + 2] << 8) + u[p + 3]; p += 4; return v; }
    if (ai === 27) { need(8); let v = 0; for (let i = 0; i < 8; i++) v = v * 256 + u[p + i]; p += 8; if (v > Number.MAX_SAFE_INTEGER) throw new WAError('bad_cbor', 'CBOR integer too large.'); return v; }
    throw new WAError('bad_cbor', 'Indefinite-length CBOR is not supported.');
  };
  function item() {
    if (++depth > 16) throw new WAError('bad_cbor', 'CBOR nesting too deep.');
    need(1);
    const b = u[p++], mt = b >> 5, ai = b & 31;
    let v;
    switch (mt) {
      case 0: v = len(ai); break;
      case 1: v = -1 - len(ai); break;
      case 2: { const n = len(ai); need(n); v = u.slice(p, p + n); p += n; break; }
      case 3: { const n = len(ai); need(n); v = td.decode(u.subarray(p, p + n)); p += n; break; }
      case 4: { const n = len(ai); if (n > 1024) throw new WAError('bad_cbor', 'CBOR array too long.'); v = []; for (let i = 0; i < n; i++) v.push(item()); break; }
      case 5: { const n = len(ai); if (n > 256) throw new WAError('bad_cbor', 'CBOR map too long.'); v = new Map(); for (let i = 0; i < n; i++) { const k = item(); v.set(k, item()); } break; }
      case 6: len(ai); v = item(); break; // tag: ignore, keep content
      case 7:
        if (ai === 20) v = false; else if (ai === 21) v = true; else if (ai === 22 || ai === 23) v = null;
        else throw new WAError('bad_cbor', 'Unsupported CBOR simple value.');
        break;
    }
    depth--;
    return v;
  }
  const value = item();
  return { value, end: p };
}

/* ---------- authenticator data ---------- */
export function parseAuthData(ad) {
  if (!(ad instanceof Uint8Array) || ad.length < 37) throw new WAError('bad_authdata', 'Authenticator data is too short.');
  const flags = ad[32];
  const out = {
    rpIdHash: ad.slice(0, 32), flagsByte: flags,
    up: !!(flags & 0x01), uv: !!(flags & 0x04), be: !!(flags & 0x08), bs: !!(flags & 0x10), at: !!(flags & 0x40), ed: !!(flags & 0x80),
    signCount: ((ad[33] << 24) >>> 0) + (ad[34] << 16) + (ad[35] << 8) + ad[36]
  };
  if (out.at) {
    if (ad.length < 55) throw new WAError('bad_authdata', 'Attested credential data is missing.');
    out.aaguid = ad.slice(37, 53);
    const n = (ad[53] << 8) | ad[54];
    if (n < 16 || n > 1023 || 55 + n > ad.length) throw new WAError('bad_authdata', 'Credential id has a bad length.');
    out.credentialId = ad.slice(55, 55 + n);
    const { value, end } = cborDecode(ad, 55 + n);
    out.cosePublicKey = value;
    out.coseBytes = ad.slice(55 + n, end);
    if (end !== ad.length && !out.ed) throw new WAError('bad_authdata', 'Unexpected bytes after the public key.');
  }
  return out;
}

/* ---------- COSE key -> JWK ---------- */
export function coseToJwk(cose) {
  if (!(cose instanceof Map)) throw new WAError('bad_key', 'Public key is not a COSE map.');
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2 && alg === COSE_ES256) {
    const crv = cose.get(-1), x = cose.get(-2), y = cose.get(-3);
    if (crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) throw new WAError('bad_key', 'EC key is not P-256.');
    return { alg: COSE_ES256, jwk: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) } };
  }
  if (kty === 3 && alg === COSE_RS256) {
    const n = cose.get(-1), e = cose.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array) || n.length < 256) throw new WAError('bad_key', 'RSA key is missing or shorter than 2048 bits.');
    return { alg: COSE_RS256, jwk: { kty: 'RSA', n: b64u(n), e: b64u(e) } };
  }
  throw new WAError('unsupported_alg', 'This passkey uses a key type Birdbird does not support (only ES256 and RS256).');
}

const importParams = alg => alg === COSE_ES256 ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
export async function importJwk(jwk, alg) {
  try { return await crypto.subtle.importKey('jwk', Object.assign({ ext: true }, jwk), importParams(alg), false, ['verify']); }
  catch (e) { throw new WAError('bad_key', 'The public key could not be read.'); }
}

/* ECDSA signatures in WebAuthn are ASN.1 DER; WebCrypto wants raw r||s */
export function derToRaw(der, size) {
  size = size || 32;
  let p = 0;
  const bad = () => { throw new WAError('bad_signature', 'Signature is not valid DER.'); };
  if (der[p++] !== 0x30) bad();
  let L = der[p++]; if (L & 0x80) { const n = L & 0x7f; if (n !== 1) bad(); L = der[p++]; }
  if (p + L !== der.length) bad();
  const int = () => {
    if (der[p++] !== 0x02) bad();
    const n = der[p++]; if (!n || p + n > der.length) bad();
    let v = der.slice(p, p + n); p += n;
    while (v.length > size && v[0] === 0) v = v.slice(1);
    if (v.length > size) bad();
    const o = new Uint8Array(size); o.set(v, size - v.length); return o;
  };
  const r = int(), s = int();
  if (p !== der.length) bad();
  return concat(r, s);
}

/* ---------- client data ---------- */
function checkClientData(cdBytes, type, expect) {
  let cd;
  try { cd = JSON.parse(td.decode(cdBytes)); } catch (e) { throw new WAError('bad_client_data', 'Client data is not JSON.'); }
  if (!cd || cd.type !== type) throw new WAError('bad_client_data', 'Wrong ceremony type.');
  if (typeof cd.challenge !== 'string' || !cd.challenge) throw new WAError('bad_challenge', 'Challenge is missing.');
  if (expect.challenge != null && cd.challenge !== expect.challenge) throw new WAError('bad_challenge', 'Challenge does not match.');
  const origins = Array.isArray(expect.origin) ? expect.origin : [expect.origin];
  if (!origins.includes(cd.origin)) throw new WAError('bad_origin', 'The passkey was used on a different site (' + String(cd.origin).slice(0, 80) + ').');
  if (cd.crossOrigin === true) throw new WAError('bad_origin', 'Cross-origin use is not allowed.');
  return cd;
}

/* Read the challenge out of clientDataJSON before full verification (so we can look it up) */
export function peekChallenge(clientDataB64) {
  try { const cd = JSON.parse(td.decode(unb64u(clientDataB64))); return typeof cd.challenge === 'string' && cd.challenge.length <= 200 ? cd.challenge : null; }
  catch (e) { return null; }
}

/* ---------- registration ---------- */
/* cred: PublicKeyCredential JSON from the browser { id, rawId, type, response:{ clientDataJSON, attestationObject, transports? } }
   expect: { challenge, origin, rpId, requireUV }  ->  { credentialId (b64u), alg, jwk, signCount, backedUp, backupEligible, transports, aaguid } */
export async function verifyRegistration(cred, expect) {
  if (!cred || cred.type !== 'public-key' || !cred.response) throw new WAError('bad_request', 'Not a passkey response.');
  const r = cred.response;
  const cdBytes = unb64u(r.clientDataJSON || '');
  checkClientData(cdBytes, 'webauthn.create', expect);
  const { value: att } = cborDecode(unb64u(r.attestationObject || ''));
  if (!(att instanceof Map) || !(att.get('authData') instanceof Uint8Array) || typeof att.get('fmt') !== 'string') throw new WAError('bad_attestation', 'Attestation object is malformed.');
  const ad = parseAuthData(att.get('authData'));
  if (!eq(ad.rpIdHash, await sha256(expect.rpId))) throw new WAError('bad_rpid', 'The passkey was made for a different site.');
  if (!ad.up) throw new WAError('no_presence', 'User presence was not confirmed.');
  if (expect.requireUV !== false && !ad.uv) throw new WAError('no_verification', 'The device did not verify you (Face ID, fingerprint or PIN).');
  if (!ad.at || !ad.credentialId) throw new WAError('bad_authdata', 'No credential in the response.');
  const idB64 = b64u(ad.credentialId);
  if (cred.id !== idB64 || (cred.rawId && cred.rawId !== idB64)) throw new WAError('bad_request', 'Credential id does not match.');
  const { alg, jwk } = coseToJwk(ad.cosePublicKey);
  await importJwk(jwk, alg); // proves the key is usable
  const transports = Array.isArray(r.transports) ? r.transports.filter(t => typeof t === 'string' && /^[a-z-]{2,20}$/.test(t)).slice(0, 6) : [];
  return { credentialId: idB64, alg, jwk, signCount: ad.signCount, backupEligible: ad.be, backedUp: ad.bs, transports, aaguid: b64u(ad.aaguid || new Uint8Array(16)), fmt: att.get('fmt') };
}

/* ---------- authentication ---------- */
/* cred: { id, rawId, type, response:{ clientDataJSON, authenticatorData, signature, userHandle? } }
   stored: { alg, jwk, signCount }  ->  { signCount, backedUp, uv } */
export async function verifyAuthentication(cred, expect, stored) {
  if (!cred || cred.type !== 'public-key' || !cred.response) throw new WAError('bad_request', 'Not a passkey response.');
  const r = cred.response;
  const cdBytes = unb64u(r.clientDataJSON || '');
  checkClientData(cdBytes, 'webauthn.get', expect);
  const adBytes = unb64u(r.authenticatorData || '');
  const ad = parseAuthData(adBytes);
  if (!eq(ad.rpIdHash, await sha256(expect.rpId))) throw new WAError('bad_rpid', 'The passkey belongs to a different site.');
  if (!ad.up) throw new WAError('no_presence', 'User presence was not confirmed.');
  if (expect.requireUV !== false && !ad.uv) throw new WAError('no_verification', 'The device did not verify you (Face ID, fingerprint or PIN).');
  const key = await importJwk(stored.jwk, stored.alg);
  let sig = unb64u(r.signature || '');
  if (stored.alg === COSE_ES256) sig = derToRaw(sig, 32);
  const data = concat(adBytes, await sha256(cdBytes));
  const ok = await crypto.subtle.verify(stored.alg === COSE_ES256 ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }, key, sig, data);
  if (!ok) throw new WAError('bad_signature', 'The passkey signature is not valid.');
  // counter: authenticators that count must move forward; synced passkeys always send 0
  if ((ad.signCount > 0 || stored.signCount > 0) && ad.signCount <= stored.signCount) throw new WAError('counter', 'This passkey may have been copied (sign counter went backwards).');
  return { signCount: ad.signCount, backedUp: ad.bs, uv: ad.uv };
}

export const _internal = { concat, eq };
