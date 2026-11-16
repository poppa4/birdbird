-- The shared flow library (functions/api/flowlib.js). The function also creates this on first use.
CREATE TABLE IF NOT EXISTS flow_lib (id TEXT PRIMARY KEY, t INTEGER NOT NULL, ac TEXT NOT NULL, phase TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, by TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL, roles TEXT NOT NULL, body TEXT NOT NULL, ipk TEXT NOT NULL, keyh TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS flow_lib_ac ON flow_lib (hidden, ac, t);
CREATE INDEX IF NOT EXISTS flow_lib_ipk ON flow_lib (ipk, t);
CREATE TABLE IF NOT EXISTS flow_lib_reports (id TEXT NOT NULL, ipk TEXT NOT NULL, PRIMARY KEY (id, ipk));
