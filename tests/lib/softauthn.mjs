/* A software passkey authenticator for tests. It makes real ES256 or RS256 key pairs with WebCrypto and builds the
   exact bytes a browser would send: CBOR attestation object ('none'), authenticator data, DER ECDSA signatures. */
const te = new TextEncoder();
export const b64u = u => Buffer.from(u).toString('base64url');
export const unb64u = s => new Uint8Array(Buffer.from(s, 'base64url'));
const sha256 = async d => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? te.encode(d) : d));
const cat = (...p) => { const o = new Uint8Array(p.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };

/* ---------- CBOR encoder (enough for COSE keys and attestation objects) ---------- */
function head(mt, n) {
  if (n < 24) return new Uint8Array([(mt << 5) | n]);
  if (n < 256) return new Uint8Array([(mt << 5) | 24, n]);
  if (n < 65536) return new Uint8Array([(mt << 5) | 25, n >> 8, n & 255]);
  return new Uint8Array([(mt << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
export function cbor(v) {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const b = te.encode(v); return cat(head(3, b.length), b); }
  if (v instanceof Uint8Array) return cat(head(2, v.length), v);
  if (Array.isArray(v)) return cat(head(4, v.length), ...v.map(cbor));
  if (v instanceof Map) { const parts = []; for (const [k, x] of v) parts.push(cbor(k), cbor(x)); return cat(head(5, v.size), ...parts); }
  if (v === true) return new Uint8Array([0xf5]); if (v === false) return new Uint8Array([0xf4]); if (v === null) return new Uint8Array([0xf6]);
  throw new Error('cbor: unsupported ' + typeof v);
}

/* raw r||s -> DER, as authenticators send it */
function rawToDer(raw) {
  const int = b => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); if (b[0] & 0x80) b = cat(new Uint8Array([0]), b); return cat(new Uint8Array([2, b.length]), b); };
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32));
  return cat(new Uint8Array([0x30, r.length + s.length]), r, s);
}

export class SoftAuthenticator {
  constructor(opts) { this.alg = (opts && opts.alg) || -7; this.creds = new Map(); this.counting = !!(opts && opts.counting); this.uv = !(opts && opts.uv === false); this.synced = !(opts && opts.synced === false); }
  async _keys() {
    if (this.alg === -7) return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    return crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  }
  async _cose(pub) {
    const j = await crypto.subtle.exportKey('jwk', pub);
    if (this.alg === -7) return new Map([[1, 2], [3, -7], [-1, 1], [-2, unb64u(j.x)], [-3, unb64u(j.y)]]);
    return new Map([[1, 3], [3, -257], [-1, unb64u(j.n)], [-2, unb64u(j.e)]]);
  }
  _flags(extra) { return 0x01 | (this.uv ? 0x04 : 0) | (this.synced ? 0x08 | 0x10 : 0) | (extra || 0); }
  /* navigator.credentials.create() equivalent; options = the JSON our server returns; returns PublicKeyCredential JSON */
  async create(options, origin, tweak) {
    tweak = tweak || {};
    const kp = await this._keys();
    const id = crypto.getRandomValues(new Uint8Array(32));
    const cose = cbor(await this._cose(kp.publicKey));
    const rpId = tweak.rpId || options.rp.id;
    const authData = cat(await sha256(rpId), new Uint8Array([this._flags(0x40)]), new Uint8Array([0, 0, 0, 0]), new Uint8Array(16), new Uint8Array([0, id.length]), id, cose);
    const clientData = te.encode(JSON.stringify({ type: tweak.type || 'webauthn.create', challenge: tweak.challenge || options.challenge, origin: tweak.origin || origin, crossOrigin: false }));
    const att = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    const c = { id: b64u(id), priv: kp.privateKey, userHandle: options.user.id, rpId: options.rp.id, count: 0 };
    this.creds.set(c.id, c);
    return { id: c.id, rawId: c.id, type: 'public-key', authenticatorAttachment: 'platform', clientExtensionResults: {},
      response: { clientDataJSON: b64u(clientData), attestationObject: b64u(att), transports: ['internal', 'hybrid'] } };
  }
  /* navigator.credentials.get() equivalent (discoverable: picks the first or the given credential) */
  async get(options, origin, tweak) {
    tweak = tweak || {};
    const c = tweak.credId ? this.creds.get(tweak.credId) : [...this.creds.values()][0];
    if (this.counting) c.count++;
    const cnt = tweak.count != null ? tweak.count : c.count;
    const authData = cat(await sha256(tweak.rpId || options.rpId), new Uint8Array([tweak.flags != null ? tweak.flags : this._flags()]), new Uint8Array([(cnt >>> 24) & 255, (cnt >> 16) & 255, (cnt >> 8) & 255, cnt & 255]));
    const clientData = te.encode(JSON.stringify({ type: tweak.type || 'webauthn.get', challenge: tweak.challenge || options.challenge, origin: tweak.origin || origin, crossOrigin: false }));
    const data = cat(authData, await sha256(clientData));
    let sig;
    if (this.alg === -7) sig = rawToDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, c.priv, data)));
    else sig = new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, c.priv, data));
    if (tweak.corruptSig) sig[sig.length - 3] ^= 0x55;
    return { id: c.id, rawId: c.id, type: 'public-key', clientExtensionResults: {},
      response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(sig), userHandle: tweak.userHandle !== undefined ? tweak.userHandle : c.userHandle } };
  }
}
