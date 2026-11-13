-- Birdbird – Flight Intelligence (/api/atc) usage counters, for the daily cost caps in functions/api/atc.js.
-- Cloudflare D1 (SQLite). Paste this whole file into the D1 console (Dashboard > Storage & Databases > D1 > birdbird > Console) and run it,
-- or run:  npx wrangler d1 execute birdbird --remote --file=migrations/0002_ai_usage.sql
-- Safe to run more than once.
-- Counters only: no question, document text or answer is ever stored.

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id  TEXT NOT NULL,                        -- users.id, or '*' for the whole site
  day      TEXT NOT NULL,                        -- UTC date, 'YYYY-MM-DD'
  requests INTEGER NOT NULL DEFAULT 0,           -- questions asked that day
  tokens   INTEGER NOT NULL DEFAULT 0,           -- input + output tokens that day, in default-model units (see MODELS weight)
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS ai_usage_day ON ai_usage(day);
