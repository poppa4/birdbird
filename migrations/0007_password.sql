-- NORDAP accounts: e-mail and password sign-in (in addition to passkeys).
-- Applied automatically by functions/_lib/api.js (ensurePasswordColumns) the first time it is needed; running it by hand
-- in the D1 console is also fine (an error "duplicate column name" means it was already applied).
ALTER TABLE users ADD COLUMN password_hash TEXT;     -- 'pbkdf2-sha256$<iterations>$<salt b64url>$<hash b64url>', NULL = no password
ALTER TABLE users ADD COLUMN password_set_at INTEGER;
