-- Birdbird – small server settings table, and no authenticator model ids.
-- Cloudflare D1 (SQLite). Paste this whole file into the D1 console (Dashboard > Storage & Databases > D1 > birdbird > Console) and run it,
-- or run:  npx wrangler d1 execute birdbird --remote --file=migrations/0003_meta.sql
-- Safe to run more than once.

-- meta: one row per setting, written by functions/_lib/api.js
--   'rl_key'        random 32-byte key (base64url) for the keyed hash of IP addresses in rate_limits, used when the
--                   RL_SECRET environment variable is not set; made once, on first use
--   'last_cleanup'  when expired challenges, sessions, old rate-limit rows and old AI counters were last deleted (ms since 1970)
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- credentials.aaguid (the authenticator model id) is no longer stored; the column stays for compatibility.
UPDATE credentials SET aaguid = NULL WHERE aaguid IS NOT NULL;
