-- "Request your aircraft" (functions/api/request.js). The function also creates this on first use.
CREATE TABLE IF NOT EXISTS plane_requests (id TEXT PRIMARY KEY, t INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, images TEXT NOT NULL DEFAULT '[]', ipk TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS plane_requests_ipk ON plane_requests (ipk, t);
CREATE INDEX IF NOT EXISTS plane_requests_sent ON plane_requests (sent, t);
