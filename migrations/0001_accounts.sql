-- Birdbird accounts: passkeys, recovery code, sessions and synced user data.
-- Cloudflare D1 (SQLite). Paste this whole file into the D1 console (Dashboard > Storage & Databases > D1 > birdbird > Console) and run it.
-- Safe to run more than once. All times are milliseconds since 1970 (UTC).

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,          -- random 16 bytes, base64url; also the WebAuthn user handle
  name                TEXT,                      -- optional display name chosen by the user
  email               TEXT UNIQUE,               -- reserved for e-mail magic links later; NULL for now
  email_verified_at   INTEGER,                   -- reserved
  recovery_hash       TEXT UNIQUE,               -- SHA-256 of the normalised one-time recovery code (never the code)
  recovery_created_at INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id              TEXT PRIMARY KEY,              -- WebAuthn credential id, base64url
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key      TEXT NOT NULL,                 -- public key as JWK JSON (no private key ever reaches the server)
  alg             INTEGER NOT NULL,              -- COSE algorithm: -7 ES256, -257 RS256
  sign_count      INTEGER NOT NULL DEFAULT 0,
  transports      TEXT,                          -- JSON array, e.g. ["internal","hybrid"]
  name            TEXT,                          -- device label, e.g. "iPhone · Safari"
  aaguid          TEXT,
  backup_eligible INTEGER NOT NULL DEFAULT 0,    -- 1 = synced passkey (iCloud Keychain, Google Password Manager …)
  backed_up       INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  last_used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS credentials_user ON credentials(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash      TEXT PRIMARY KEY,                 -- SHA-256 of the random session id in the cookie
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  via          TEXT,                             -- 'signup' | 'passkey' | 'recovery'
  device       TEXT                              -- short device label from the user agent
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_data (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ns         TEXT NOT NULL,                      -- 'progress' | 'packs' | 'routes' | 'settings'
  data       TEXT NOT NULL,                      -- JSON object: { localStorageKey: value }
  version    INTEGER NOT NULL,                   -- +1 on every write; used for the conflict check
  updated_at INTEGER NOT NULL,                   -- when the data was changed on the device
  stored_at  INTEGER NOT NULL,                   -- when the server stored it
  PRIMARY KEY (user_id, ns)
);

CREATE TABLE IF NOT EXISTS challenges (
  challenge  TEXT PRIMARY KEY,                   -- single-use WebAuthn challenge (later also hashed e-mail tokens)
  kind       TEXT NOT NULL,                      -- 'reg' | 'auth' (reserved: 'email')
  user_id    TEXT,
  data       TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_expires ON challenges(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,                 -- bucket + hashed IP or user id (no raw IP addresses are stored)
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
