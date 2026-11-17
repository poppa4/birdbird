# Switching from birdbird.eu to nordap.eu

Done on 17 November 2026. nordap.eu is the main address.

## Cloudflare and the registrar (done)
1. nordap.eu is a Cloudflare zone (nameservers moved at Domeneshop, DNSSEC off).
2. Pages project → Custom domains: `nordap.eu` and `www.nordap.eu` are Active, next to `birdbird.eu` and `www.birdbird.eu`.
3. No redirect from birdbird.eu yet: the site has no users, and the owner may still need to export browser data there.
   When birdbird.eu is no longer wanted: Rules → Redirect rules on the birdbird.eu zone, all requests →
   `concat("https://nordap.eu", http.request.uri.path)`, 301, keep the query string.

## Code (done)
Every `birdbird.eu` in pages, scripts, Functions (passkey host, User-Agents, cache keys), sitemap, tests and tools now reads
`nordap.eu`. Download names start with `nordap-`. The Pages project, the D1 database and the GitHub repository keep the name `birdbird`.

## Still to do by the owner
- ArcGIS API key (Route Explorer high-resolution satellite): add `https://nordap.eu/*` and `https://www.nordap.eu/*` as referrers.
  Until then the map falls back to EOX Sentinel-2 imagery on nordap.eu.

## What changes for a user
- Passkeys are tied to the address. An account made on birdbird.eu cannot sign in on nordap.eu; it must be made again there.
  birdbird.eu keeps working with its own passkeys (the server uses the visiting host as relying party when it is not nordap.eu).
- Data saved in the browser (My workspace, own checklists, flows, briefing packs) is stored per address. Export on birdbird.eu and import on nordap.eu.

## Not to rename
Storage keys, the database name `birdbird-workspace`, the export format `app:'birdbird'` and the backup file name inside the zip
(`birdbird-backup.json`). Renaming them makes old backups unreadable.
