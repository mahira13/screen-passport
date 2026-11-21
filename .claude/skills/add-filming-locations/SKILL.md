---
name: add-filming-locations
description: Research and add filming locations for a work, with sources, for the locations table or seed CSV. Use when processing requests or expanding coverage.
---

# Adding filming locations

## Sources, in order of trust
1. Official tourism or city sites (visitBerlin, Brandenburg tourism board, berlin.de, film commissions).
2. Established location guides (Atlas of Wonders, Movie-Locations.com, major newspapers).
3. Wikidata `filming location` (P915). Often only city-level; mark it so.

Never scrape IMDb (terms forbid it). Never copy text or photos from guides: write the scene note in your own words and link the page.

## Each row needs
- `work_id`, `name`, `scene_note` (own words; if the source names the place but not the scene, write "Featured location (see source)")
- `address`, `city`, `region`
- `lat`, `lng` with `coord_quality`: `source` if the page gives coordinates, else leave empty for `npm run geocode`
- `visit_note` (ticketed, exterior only, check access, cemetery etiquette)
- `source_name`, `source_url` (required)
- `status`: `unverified` for anything found by Claude; a human sets `live` after checking

## Skip
- Private homes and gardens.
- Studio-only sets visitors can't enter.
- Places that no longer exist, unless the visit note says what's there now.

## Processing a request
1. Find the work and 3–10 visitable locations with sources.
2. Insert as `unverified`, set the request to `researched`.
3. A teammate checks each source in the admin page and approves.
