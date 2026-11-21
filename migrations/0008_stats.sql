-- NORDAP anonymous visit counting (functions/_lib/stats.js). The tables are also made on first use; running this is optional.
-- No IP addresses or cookies: a visitor is a daily-changing hash. Safe to run more than once.
CREATE TABLE IF NOT EXISTS stat_day (day TEXT NOT NULL, vid TEXT NOT NULL, first_at INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, vid));
CREATE TABLE IF NOT EXISTS stat_page (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
CREATE TABLE IF NOT EXISTS stat_live (vid TEXT PRIMARY KEY, at INTEGER NOT NULL, path TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS stat_live_at ON stat_live (at);
