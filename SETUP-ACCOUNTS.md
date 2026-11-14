# Setting up accounts on birdbird.eu

Birdbird accounts (passkey sign-in and sync of progress, briefing packs, routes and settings) run as
Cloudflare Pages Functions in `/functions` and store their data in a Cloudflare D1 database. The code is
already in the repository. Until the steps below are done, the site works as before and the Account
section on My training says "Accounts are being switched on".

Everything is done by clicking in the Cloudflare dashboard. No commands are needed.

## 1. Create the database

1. Log in at dash.cloudflare.com and pick the account that has the **birdbird** Pages project.
2. In the left menu, open **Storage & databases**, then **D1 SQL database**.
3. Click **Create database**.
4. Name: `birdbird`
5. Under **Data location**, choose **Specify jurisdiction** and pick **eu (The European Union)**.
   This keeps the data in the EU. It can only be chosen now, not later.
   If that option is not offered, choose **Location hint: Western Europe** instead, and then edit the
   "Where." paragraph in `privacy.html` (section "Accounts and sync"), because it says the EU jurisdiction is used.
6. Click **Create**.

## 2. Create the tables

1. Open the new **birdbird** database and go to the **Console** tab.
2. Paste all of the SQL below into the box and click **Execute**.
3. You should see it succeed. Running it twice does no harm.

```sql
CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, email_verified_at INTEGER, recovery_hash TEXT UNIQUE, recovery_created_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS credentials ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, public_key TEXT NOT NULL, alg INTEGER NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT, name TEXT, aaguid TEXT, backup_eligible INTEGER NOT NULL DEFAULT 0, backed_up INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_used_at INTEGER );
CREATE INDEX IF NOT EXISTS credentials_user ON credentials(user_id);
CREATE TABLE IF NOT EXISTS sessions ( id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, via TEXT, device TEXT );
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS user_data ( user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, ns TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL, stored_at INTEGER NOT NULL, PRIMARY KEY (user_id, ns) );
CREATE TABLE IF NOT EXISTS challenges ( challenge TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT, data TEXT, expires_at INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS challenges_expires ON challenges(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits ( key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL );
```

(The same SQL, with explanations, is in `migrations/0001_accounts.sql`.)

To check: open the **Tables** tab of the database. You should see `users`, `credentials`, `sessions`,
`user_data`, `challenges` and `rate_limits`.

## 3. Connect the database to the site

1. In the left menu, open **Workers & Pages** and click the **birdbird** project.
2. Go to **Settings**, then **Bindings** (in older dashboards: Settings, Functions, D1 database bindings).
3. Make sure **Production** is selected at the top, click **Add**, choose **D1 database**.
4. Variable name: `DB` (exactly that, capital letters). D1 database: **birdbird**. Click **Save**.
5. Optional, for preview deployments: switch to **Preview** and add the same binding. Previews then use the
   same database; passkeys made on a preview address only work on that preview address.

## 4. Redeploy

Bindings only take effect on a new deployment.

1. In the **birdbird** project, open **Deployments**.
2. On the latest **Production** deployment, open the **⋯** menu and click **Retry deployment**
   (or push any commit to `main`).
3. When it shows Success, open https://birdbird.eu/profile.html#account. You should see
   "Create account with a passkey". If it still says "Accounts are being switched on", the binding is
   missing or misspelled (step 3), or the deployment is still the old one (step 4).

## 5. Test it on real devices

- On an iPhone (Safari): create an account with Face ID, save the recovery code, take a quiz, then
  open birdbird.eu on a Mac signed in to the same Apple ID and sign in with the passkey (iCloud Keychain
  syncs it). The quiz result should appear.
- On a Windows PC without the passkey: choose "Sign in with a passkey" and scan the QR code with the phone.
- Try "Use a recovery code" on a private browser window, then delete the test account on My training.

## Good to know

- **Nothing to configure.** No secrets or environment variables are needed. The passkey site id is
  `birdbird.eu` (also valid on www.birdbird.eu). Optional variable `RP_ID` overrides it if the domain changes.
- **Settings table (migration 0003).** Run `migrations/0003_meta.sql` once as well (D1 console, or
  `npx wrangler d1 execute birdbird --remote --file=migrations/0003_meta.sql`; safe to run more than once). It adds the small
  `meta` table (the key for hashing IP addresses in rate limits, and when old rows were last cleaned up) and clears the
  stored authenticator model ids. Until it is applied everything still works, with an occasional cleanup instead of an hourly one.
- **Optional `RL_SECRET`.** IP addresses in `rate_limits` are stored only as an HMAC. Without `RL_SECRET` the key is a random
  value kept in `meta` and rotated daily. To use your own instead: Workers & Pages → birdbird → Settings → Variables and
  Secrets → Add, type **Secret**, name `RL_SECRET`, a long random value (e.g. `openssl rand -base64 32`), then redeploy.
- **Not served to visitors:** `/functions` is never published by Cloudflare Pages, and small Functions
  answer 404 for `/migrations/*`, `/tests/*`, `/SETUP-ACCOUNTS.md` and `/LAB-TEMPLATE.md` (Pages' `_redirects` cannot return a 404).
- **Free plan limits:** D1 free plan (5 GB, 5 million row reads a day) and Pages Functions (100,000 requests
  a day) are far above what Birdbird needs. Visitors who are not signed in do not call the API, except
  once on My training.
- **Looking at data:** the D1 Console can run `SELECT id, name, created_at FROM users;` and so on.
  Passwords do not exist; recovery codes and session ids are stored only as hashes.
- **Deleting a user by hand** (if someone e-mails you): find the id in `users`, then run
  `DELETE FROM user_data WHERE user_id='ID'; DELETE FROM sessions WHERE user_id='ID'; DELETE FROM credentials WHERE user_id='ID'; DELETE FROM users WHERE id='ID';`
- **Later, e-mail magic links:** `users.email` and `users.email_verified_at` are already there (empty), and
  `challenges.kind` is ready for an `email` token type. Sending e-mail needs a provider; nothing is set up for it now.
- **Developers:** `node --test tests/*.test.mjs` runs the unit tests (Node 22+, no packages needed).
  With `wrangler pages dev . --d1 DB=<id>` and the migration applied locally,
  `node tests/e2e-http.mjs http://localhost:8788` and `python3 tests/browser_e2e.py http://localhost:8788`
  test the real Functions; `python3 tests/frontend_mock.py` tests the pages with a mocked API.

## Flight Intelligence (free AI, Cloudflare Workers AI)

Flight Intelligence (`/api/atc`) runs on Cloudflare Workers AI's free daily allocation when no Anthropic key is set.
It needs the accounts database above, plus two things:

1. **Usage table.** Open the D1 console for **birdbird** and run the contents of `migrations/0002_ai_usage.sql`
   (safe to run more than once).
2. **AI binding.** In **Workers & Pages → birdbird → Settings → Bindings**, with **Production** selected, click **Add**,
   choose **Workers AI**, variable name `AI` (exactly that). Save.
3. **Redeploy** (Deployments → latest Production → ⋯ → Retry deployment).

Then open https://birdbird.eu/fi.html signed in and ask a question. Signed-out visitors are asked to sign in.
Daily caps for the free engine are in `WORKERS_LIMITS` in `functions/api/atc.js` (about 300 questions a day for the
whole site, 25 per user), set so the account stays inside the free 10,000 Neurons. On the Workers Free plan Cloudflare
never bills: when the allocation is used up the AI simply answers "back tomorrow".
