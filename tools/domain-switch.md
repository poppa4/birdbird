# Switching from birdbird.eu to nordap.eu

Nothing here is switched on. birdbird.eu stays the live address until every step is done.

## In Cloudflare and at the registrar (owner)
1. Pages project → Custom domains → add `nordap.eu` and `www.nordap.eu`; set the DNS records Cloudflare shows at the registrar.
2. Wait until both show "Active" and the site opens on https://nordap.eu.
3. Only then: add a redirect rule (Rules → Redirect rules) from `birdbird.eu/*` to `https://nordap.eu/$1`, status 301. Keep birdbird.eu registered.

## In the code (one commit, after step 2)
- `sitemap.xml` and `robots.txt`: every `https://birdbird.eu/` → `https://nordap.eu/`.
- `functions/_lib/api.js`: the fixed passkey host (default of `RP_ID`) and the allowed origins.
- `account.js`, `profile.html`: texts that name the address a passkey belongs to.
- `functions/api/wx.js`, `winds.js`, `sigmet.js`, `functions/_lib/aipres.js`, `rxmap.js`, `flows.js`, `weather.html`, `route.html`, `prep.html`: contact address in the User-Agent and in links.
- `tools/live-check.mjs`, `tests/*`: the address the checks call.
- `SETUP-ACCOUNTS.md`: the address in the instructions.

## What users lose
- Passkeys are tied to the address. An account made on birdbird.eu cannot sign in on nordap.eu; it must be made again there.
- Data saved in the browser (My workspace, own checklists, flows, briefing packs) is stored per address. Export on birdbird.eu and import on nordap.eu, before the redirect is switched on.

## Not to rename
Storage keys, the database name `birdbird-workspace`, the export format `app:'birdbird'` and the backup file name. Renaming them makes old backups unreadable.
