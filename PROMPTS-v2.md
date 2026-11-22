# Screen Passport v2: Claude Code prompts

Paste one at a time, in order. Each prompt extends what exists and ends with checks you can do on your phone. Commit after each one.

---

## 1. Inspect and plan (no code)

Read CLAUDE.md, docs/VISION.md, every SKILL.md, the Supabase migrations, seed CSVs, API routes and pages. Then report:
1. What already exists and works (with file paths).
2. What is incomplete or inconsistent with docs/VISION.md.
3. Whether the current schema supports both nearby discovery and cross-city collections, including one location shared by several titles.
4. A step-by-step plan that maps onto prompts 2–14 in PROMPTS-v2.md, adjusted to what you found.
Do not write code. Do not remove or rename anything yet.

---

## 2. Data model v2 (additive migration)

Write `supabase/migrations/002_catalogue.sql`, additive only, keeping every existing table, column and query working:
- `create extension if not exists postgis; create extension if not exists pg_trgm;`
- `locations`: add `country`, `country_code` (ISO 3166-1 alpha-2), `verification_status` (draft | verified | published | rejected, default draft), `location_confidence` (exact | building | street | area), `public_access` (public | exterior_only | restricted | unknown, default unknown), `is_filming_location boolean default true` (false = story setting only, never shown as "filmed here"), `verified_at`, `geog geography(Point,4326)` kept in sync with lat/lng by a trigger, and a GiST index on `geog`.
- New `location_works(location_id, work_id, scene_note, depicts, evidence_url, primary key(location_id, work_id))`: one place, many titles.
- Backfill: copy each location's `work_id` and `scene_note` into `location_works`; set `verification_status = 'published'` where `status = 'live'`; set `country = 'Germany'`, `country_code = 'DE'` for existing German rows and the right values for London rows. Find duplicate places (same name and city, or within 30 m) and merge them into one location with several `location_works` rows; print what was merged.
- Keep `locations.work_id` and `status` for now (nullable, deprecated); update reads to use `location_works` and `verification_status`.
- RPC `nearby_locations(lat, lng, radius_km default null, work_id default null, max_results default 200)`: only `verification_status = 'published' and is_filming_location`; returns location fields, distance_km and the titles it belongs to. `radius_km null` = anywhere.
- Trigram indexes on `works.title`, `locations.city`, `locations.country`; an RPC `search_catalogue(q)` returning matching works, cities and countries.
- RLS: public read only for published locations, their `location_works`, works and collections.
Add tests for the RPCs. Done when existing pages still work and `nearby_locations` returns the same Berlin results as before.

---

## 3. Collections and challenges as one system

Migration `003_collections.sql`:
- Extend `collections`: `slug unique`, `kind` (film | series | city | theme), `description`, `country`, `is_featured boolean`, `cover_style` (a design token, not an image).
- New `collection_items(collection_id, location_id, position)`.
- Auto-generate one collection per work (all its published locations, all cities and countries) and one per city with 5+ locations; keep the existing hand-made ones and convert their `work_ids` into items.
- `passport_badges(passport_id, collection_id, completed_at)`, written by a server route when every item is visited.
- Progress is computed from `passports.visited` (no new tracking table).
Done when /collections lists film, city and themed collections with correct progress for my passport.

---

## 4. Data pipeline and curation tools

- CSV format v2 in `data/seed/` matching the new columns plus a `location_works.csv`; update `scripts/import-seed.ts` to upsert by id.
- `scripts/wikidata-candidates.ts`: SPARQL for filming location (P915) of given works, with coordinates; insert as `draft` with `location_confidence = 'area'` unless the item is a specific building; never auto-publish.
- `scripts/tmdb-metadata.ts`: fill title, year, aliases (alternative titles in DE and EN) for works; respect TMDB terms (attribution, key from env); no filming locations from TMDB.
- Update `/admin/locations`: filter by status, show evidence links and a map pin you can drag, fields for confidence, access, country, "filming location vs story setting", buttons Verify and Publish, and a duplicate warning when a place within 30 m exists.
Done when I can take a Wikidata draft to published in the admin page.

---

## 5. Navigation and home

Main navigation: Discover · Collections · Map · My Passport (bottom bar on mobile, top on desktop). Home asks "What cinematic adventure do you want to go on?" with three large entry points: Find filming locations near me, Explore a film or series, Discover a cinematic collection. Keep existing routes working (redirect where pages moved). Editorial, cinematic look, not a dashboard.

---

## 6. Discover

- Nearby: current location or city picker; radius chips 5 · 10 · 25 · 50 km · Anywhere, using `nearby_locations`.
- Search by film, series, city or country using `search_catalogue`.
- Sections: Near you, Featured collections, Popular titles.
- Clear empty states: "No verified locations within 10 km. Try 25 km or explore a collection."

---

## 7. Public pages: title and location

- `/title/[id]`: about the work (from our data), all its published locations grouped by country and city, a map, "Start this collection", "Create a trip".
- `/location/[id]`: place, address, city, country, every title filmed here with what it depicted, distance from me, access info, evidence link, verification badge, Directions, "I'm here" check-in when allowed.
- Open Graph images for both. Existing `/t/...` links redirect.

---

# 8. Explore map — revised

Full-screen Leaflet map, published locations only, with clustering (leaflet.markercluster) and filters: title, collection, city, radius (5/10/25/50 km/anywhere).

Markers: NO colour-coded circles and NO film/series images of any kind (CLAUDE.md: no stills, posters, logos).
- Location has an approved/auto Commons photo: round photo marker (L.divIcon), ~44px, use the Commons thumb URL (upload.wikimedia.org/.../thumb/... at 96px width) with loading="lazy", 2px gold (#E3B04B) ring.
- No photo: navy (#1D2B4A) circle with the title's initials in gold, Space Grotesk. Plain text only.
- Approximate coordinates: dashed ring. Popup says "Approximate location". Never offer check-in.
- Title filter active: matching markers get a 3px gold ring + slight scale, non-matching drop to 35% opacity (if not hidden by the filter).
- Clusters: circular photo of the first located item that has a photo (else gold count circle), with a count badge.

Popup: photo with its credit line (reuse the photo+credit component), location name, title(s) filmed here, distance from user, verification badge (AI-verified / Team-verified), link to /location/[id]. If /location/[id] doesn't exist yet, create a minimal page using the same card + photo component, not a placeholder.

Performance: only render markers in view (cluster handles it), don't load full-size images, test with all published rows on mobile.
Accessibility: each marker gets an aria-label "<location> — <title>".

Show me the marker component and a screenshot/description of a filtered and unfiltered view before moving on.

---

## 9. My Passport

Stamps for watched titles (outline) and visited places (gold), collection progress rings, badges for completed collections, recent check-ins, and the share card. Keep the anonymous passport (random id, localStorage, `/p/[id]`), no login.

---

## 10. Trips from collections

Reuse the existing trips feature: "Create a trip" on any collection, title or city page, pre-filled with that collection's nearby locations. Keep the Claude itinerary rules (only given location IDs, validated, fallback plan), joining by first name, and the invite card.

---

## 11. Connect: challenges with friends

- "Challenge friends" on any collection creates `challenges(id, collection_id, created_by_passport, created_at)` and `challenge_participants(challenge_id, passport_id, display_name, joined_at)`; no public RLS, server routes only.
- `/challenge/[id]`: the collection, each participant's progress (first names), who finished first, Join with a first name, Share with an Open Graph image.
- Scene postcard after check-in: the user's own photo, letterbox frame, own caption, no stills or quotes.

---

## 12. Community suggestions

"Suggest a location" on title and location pages: title, place, address or map pin, evidence URL (required), note. Stored in `location_suggestions` (insert-only, rate-limited, URLs validated). Admin can turn a suggestion into a draft location in one click. Suggesters see "Thanks, we'll check it", no accounts.

---

## 13. Cinematic design pass

Apply one editorial design system across all pages: typography with character (display headings, readable body), a dark cinematic palette with one warm accent, generous spacing, letterbox and ticket motifs used sparingly, smooth transitions, accessible contrast (4.5:1), 44 px touch targets, phone first. Remove anything that looks like a SaaS dashboard.

---

## 14. Quality, privacy and launch check

Run the demo-ready skill. Also check: every share link opens a real public page without login; only published locations show as confirmed; unverified items are labelled; rate limits on trips, joins, suggestions and research; Impressum and privacy pages; cookieless analytics; Lighthouse on mobile. List what fails and fix it.
