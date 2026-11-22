---
name: add-filming-locations
description: Research and add filming locations for a work, with sources, for the locations table or seed CSV. Use when processing requests or expanding coverage.
---

# Adding filming locations

## Sources, in order of trust
1. Official tourism or city sites (visitBerlin, Brandenburg tourism board, berlin.de, film commissions).
2. Established location guides (Atlas of Wonders, Movie-Locations.com, major newspapers).
3. Wikidata `filming location` (P915). Often only city-level; mark it so. Wikidata finds candidates but is never the only evidence.

Never scrape IMDb (terms forbid it). Never copy text or photos from guides: write the scene note in your own words and link the page.

## Each row needs
- `work_id`, `name`, `scene_note` (own words; if the source names the place but not the scene, write "Featured location (see source)")
- `address`, `city`, `region`
- `lat`, `lng` with `coord_quality`: `source` if the page gives coordinates, else leave empty for `npm run geocode`
- `visit_note` (ticketed, exterior only, check access, cemetery etiquette)
- `source_name`, `source_url` (required)
- Insert as `draft` (never published directly). It goes live only by passing `npm run verify` (the AI verification pipeline: filmed here, not a story setting, high confidence, quote found on the page, trusted domain from `lib/trusted-sources.ts`, not a private home, no published place within 30 m) or by a teammate publishing it in /admin/locations. Everything else stays `needs_review`.

## Skip
- Private homes and gardens.
- Studio-only sets visitors can't enter.
- Places that no longer exist, unless the visit note says what's there now.

## Processing a request
1. Find the work and 3–10 visitable locations with sources.
2. Insert as `unverified`, set the request to `researched`.
3. Run `npm run verify` (or "Run AI verification" in /admin/locations). Places it can't confirm wait in /admin/locations with their reasons for a teammate.
