# Prompts for Claude Code

Paste these one at a time. Each ends with something you can test on your phone.

## 0. Kickoff (paste first)

Read CLAUDE.md and every SKILL.md in .claude/skills before writing code. Then:

1. Set up a Next.js (App Router, TypeScript, Tailwind) project in this folder, plus Supabase client, Leaflet and html-to-image.
2. Write `supabase/migrations/001_init.sql` for the data model in CLAUDE.md, including the row-level security rules.
3. Write `scripts/import-seed.ts` that loads `data/seed/titles.csv`, `locations.csv` and `collections.csv` into Supabase (aliases and work_ids are `|`-separated). Rows with empty lat/lng are imported but skipped by the nearby query until geocoded.
4. Write `scripts/geocode.ts` that fills empty lat/lng from `address + city` with OpenStreetMap Nominatim (one request per second, a proper User-Agent) and sets `coord_quality = 'geocoded'`.
5. Add `lib/distance.ts`, `lib/match.ts`, `lib/collections.ts` with unit tests.

Stop when `npm test` passes and the seed import works. Show me the commands to run.

## 1. Instant first screen

Build `app/page.tsx` per CLAUDE.md: city picker (default Berlin) plus "Use my location"; `/api/nearby` returns live locations sorted by distance with the distance bands; show a Leaflet map and a list of title cards grouped by title (title, how many places, closest place and its distance). Mobile first. Fire `map_viewed`. Done when it loads on my phone in under 3 seconds.

## 2. Watched it → live passport

Add a "Watched it" toggle on each title card. Keep the passport in React state and localStorage; show a sticky PassportBar ("3 films · 18 places · closest 0.3 km"). On first tap create a passport via `/api/passport` with a random 12-character id and update it on later taps. `/p/[id]` renders a saved passport. Fire `title_watched` and `passport_created`. Done when I can reopen my passport link on a laptop.

## 3. Share card

Build ShareCard per the share-card skill (1080×1920, navy/cream/gold, stamps, dot map, closest place, collection line, link). Share with the Web Share API (file) and fall back to download. Fire `share_clicked`. Done when I can post it to an Instagram story from my phone.

## 4. Location cards and Layla handoff

LocationCard: name, title, scene note, distance, visit note, buttons Directions (Google Maps URL from lat/lng), Source (source_url), "Plan the rest with Layla" (copy a prompt like "Plan a day in <city> visiting <places> where <title> was filmed" to the clipboard and open https://layla.ai in a new tab). Fire `directions_clicked` and `layla_clicked`.

## 5. Search and requests

TitleSearch with autocomplete over works (title + aliases) only. If nothing matches, offer "Add it to our list", POST to `/api/request` (upsert by normalised title, increment count), and show "Thanks, we'll add it". Fire `request_created`.

## 6. Collections

Show collection progress from `collections` (e.g. "Cold War Berlin 2/4") on the passport and the share card. Tests for progress maths.

## 7. Check-in and postcard

CheckInButton: browser geolocation; success if within 200 m of the location (haversine) → add to `visited`, stamp turns gold, fire `checkin_success`; otherwise say how far away they are. After success, offer PostcardMaker per the share-card skill (user photo + frame, 4:5 and 9:16, composed on canvas, never uploaded). Fire `postcard_made`.

## 8. Admin page

`/admin/requests` behind ADMIN_PASSWORD: list open requests by count; for a researched request show its unverified locations with source links; Approve sets them live and the request to approved.

## 9. Nice to have: screenshot upload

Build `/api/read-screenshot` and ScreenshotUpload per the screenshot-titles skill, wired into the same matching and requests flow. Fire `screenshot_read`.

## 10. Before the demo

Run the demo-ready skill checklist and tell me what fails.

## Research prompt (for the data person, in Claude chat)

Find 5–10 visitable filming locations for "<title>" in or near <city>. Use official tourism sites and established location guides first. For each give: location name, what it was in the film/series in my own words, address, city, a visit note, and the source URL. Skip private homes and closed studio sets. Output as CSV rows matching data/seed/locations.csv.
