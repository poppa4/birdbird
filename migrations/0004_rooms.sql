-- NORDAP – live rooms for the flow trainer (functions/api/room.js makes these on first use; this file documents them).
-- Cloudflare D1 (SQLite). Safe to run more than once:  npx wrangler d1 execute birdbird --remote --file=migrations/0004_rooms.sql
CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, flow TEXT NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL, seq INTEGER NOT NULL DEFAULT 0, members TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS room_events (code TEXT NOT NULL, seq INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (code, seq));
CREATE INDEX IF NOT EXISTS rooms_touched ON rooms (touched);
