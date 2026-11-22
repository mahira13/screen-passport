# Screen Passport

Collect the places your favourite films and series were shot. Visit them, stamp them, share them.

Open the link and within seconds you see what was filmed near you. Tap "Watched it" on the titles you've seen and your Screen Passport fills with stamps. Create a trip that others can join, check in on site to turn a stamp gold, frame your own photo as a scene postcard, and share it. "Plan travel and stays with Layla" hands the logistics to Layla.

Built at the Layla Build & Launch Hackathon, Berlin, 21–22 Nov 2026.

## Product direction

The long-term vision is in `docs/VISION.md` and the build steps in `PROMPTS-v2.md`. Where they differ from this file, the vision wins on product direction; the product rules above (sources, privacy, no copyrighted media, no private homes, honest numbers) always apply.

## Product rules (read before changing anything)

1. **Instant value, no downloads.** The first screen shows filming locations near the user with zero input. No login, no CSV upload, no Netflix connection (Netflix has no public API; never ask for passwords or scrape accounts).
2. **Ways in, in order:** near-me map → "Watched it" taps on title cards → search box that only selects titles from our database → optional screenshot upload where Claude reads titles. Free text that matches nothing becomes a request, never an AI answer.
3. **Every location has a source.** No row in `locations` without `source_url`. Trusted sources: official tourism and city sites, established location guides and major media (see the add-filming-locations skill); not Wikipedia or fan wikis. Claude never invents locations, coordinates or scenes. Only `verification_status = 'published'` filming locations are shown (migration 007; the old `status = 'live'` is kept in step until it is removed). Wikidata finds candidates but is never the only evidence for a published place.
4. **Code for facts, Claude for words and images.** Distance, sorting, matching, check-in radius and collections are plain code. Claude is used only to read titles from screenshots, for fuzzy title matching, to research requested titles, and to read evidence pages in the AI verification pipeline. **Publishing:** a location may be published only when it is team-verified, or when it passes the AI verification pipeline's strict criteria (filmed_here true, not a story setting, high confidence, evidence quote found on the fetched page, trusted source domain from `lib/trusted-sources.ts`, geocode not residential, no published place within 30 m). Store `verification_method` (`ai` | `team`) and show it as a badge. Anything else stays `draft` or `needs_review` and is never shown as a confirmed filming location. Locations found by Claude research are always inserted as `draft` and go through the pipeline; Claude never publishes directly.
5. **Privacy:** no accounts, no emails, no raw uploads stored. Screenshots are read and discarded. Postcard photos are composed in the browser and never uploaded unless the user shares them. Passports store only title IDs, location IDs, start city and an optional display name.
6. **No copyrighted media:** no film stills, scraped posters, logos or script quotes. Postcards use the user's own photo. Location photos only from Wikimedia Commons with credit.
7. **No private homes** and no closed studio sets, even if a guide lists them.
8. **Honest numbers:** stage metrics come from real events only.

## Scope

**Must work for any user (by Sunday 14:00):**
- Near-me map + list (browser location or city picker), grouped by distance band
- Title cards with "Watched it" → live passport (stamps, place count, closest place)
- Passport saved under a random unguessable ID, shareable URL `/p/[id]`, last passport remembered in localStorage
- Share card image (story format 1080×1920) generated in the browser, one-tap share/download
- Collections with progress (e.g. "Cold War Berlin 2/4", "Görliwood 1/4")
- "I'm here" check-in: browser geolocation within 200 m of a location (or inside its bounding box, for large sites like parks and stadiums) → gold stamp. Offered where `coord_quality` is `source`, `verified` or `geocoded_poi`: a geocoder match on a named landmark (Nominatim class tourism, historic, amenity, building, leisure or similar; not a plain address, road, suburb or city) whose name fuzzy-matches the location name and whose city matches. Other geocoded or approximate points can be kilometres off: they show "Approximate location", allow no check-in and are never part of a curated challenge.
- Scene postcard: user photo + frame (title, place, "Filmed here") composed client-side
- Location card actions: Directions (Google Maps), Source link, "Plan the rest with Layla" (opens Layla; copies a ready prompt to clipboard)
- Requests table for unknown titles; admin page to approve researched locations
- Analytics events

**Trips (built, keep and extend):** "Create a trip" from a title, collection or city. Code selects and orders published locations near the start point; Claude writes the itinerary (times, travel steps, why fans love each stop) using only the given location IDs, validated, with a code-built fallback plan. Trip page `/trip/[id]` with map, Directions, "Open all in Google Maps", "Plan travel and stays with Layla", joining by first name (max 50), share via Web Share API and the "Now showing" invite card, Open Graph previews. Times shown in the trip's timezone with the city name (`tz` per city in `lib/cities.ts`, or the browser timezone).

**Launch safety (built, keep):** rate limits (trips 5/IP/day, global Claude trip cap 300/day then fallback plan, joins 20/IP/day and 50/trip); URL and offensive-word filter on names, titles and meeting points; "Report this trip" (hidden after 3 reports); secret organiser delete link; `/api/request` for unknown titles (counts new ones, reports existing); `/impressum` and `/privacy`; cookieless analytics.

**Nice to have:** screenshot upload (Claude vision reads titles), compare passports with a friend, title pages.

**Out:** login, Netflix/Spotify connections, books, native app, live prices.

## Stack

- Next.js (App Router) + TypeScript, Tailwind, deployed on Vercel
- Supabase Postgres (no Supabase Auth this weekend)
- Leaflet + OpenStreetMap tiles (show attribution)
- html-to-image (share card) and canvas (postcard)
- Anthropic SDK in server routes only; model from `ANTHROPIC_MODEL`, key in `ANTHROPIC_API_KEY`
- Plausible or PostHog for analytics

## Project structure

```
screen-passport/
  CLAUDE.md  PROMPTS.md
  .claude/skills/                # playbooks, see "Skills"
  app/
    page.tsx                     # near-me map + title cards (first screen)
    p/[id]/page.tsx              # a saved passport (shareable)
    t/[id]/page.tsx              # title page: where it was filmed (nice to have)
    admin/requests/page.tsx      # approve researched requests (ADMIN_PASSWORD)
    api/nearby/route.ts          # live locations sorted by distance
    api/passport/route.ts        # create/update passport -> id
    api/request/route.ts         # unknown title -> requests (+count)
    api/read-screenshot/route.ts # Claude vision -> {titles: []} (nice to have)
    api/trip/route.ts            # select + order locations, Claude itinerary, validate, fallback
    trip/new/page.tsx  trip/[id]/page.tsx
  components/
    CityPicker.tsx  NearbyMap.tsx  TitleCard.tsx  LocationCard.tsx
    PassportBar.tsx  ShareCard.tsx  Collections.tsx  CheckInButton.tsx
    PostcardMaker.tsx  TitleSearch.tsx  ScreenshotUpload.tsx
  lib/
    distance.ts      # haversine, distance bands
    match.ts         # normalise + alias matching
    cities.ts        # German start cities with coordinates
    collections.ts   # progress calculation
    layla.ts         # Layla handoff prompt + link
    supabase.ts  analytics.ts  ids.ts (random passport ids)
  supabase/migrations/001_init.sql
  data/seed/titles.csv  data/seed/locations.csv  data/seed/collections.csv
  scripts/import-seed.ts  scripts/geocode.ts
  tests/distance.test.ts  tests/match.test.ts  tests/collections.test.ts
```

## Data model

- `works(id text pk, title, type ['series','film'], aliases text[], year int null)`
- `locations(id serial pk, work_id fk, name, scene_note, address, city, region, lat, lng, coord_quality ['source','approx','geocoded','verified'] null, visit_note, source_name, source_url not null, status ['live','unverified'] default 'unverified', geocode_query)`

Seed CSVs use exactly these column names, so the import needs no mapping. Seed rows arrive as `unverified`: a teammate checks each source and coordinate in the admin page before setting it `live`.
- `collections(id text pk, name, city, work_ids text[], description)`
- `passports(id text pk, display_name null, start_city, lat, lng, watched text[], visited int[], created_at, updated_at)`
- `requests(id serial pk, raw_title, normalised_title unique, count int, status ['open','researched','approved','rejected'], created_at)`
- `events(id serial pk, name, props jsonb, created_at)`
- `trips(id text pk, title, intro, work_ids text[], start_label, start_lat, start_lng, mode, length, starts_at, timezone, meeting_point, organiser_name, plan jsonb, created_at)` and `trip_joins(id, trip_id, first_name, created_at)`; no public RLS, server routes only

The v2 catalogue (location_works, PostGIS, collection_items, challenges, suggestions) is described in PROMPTS-v2.md and added by migrations 002+.

Row-level security: anyone can insert a passport and read one by exact id; nobody can list passports. Locations/works/collections are public read. Requests are insert-only for the public. Admin actions go through server routes with `ADMIN_PASSWORD`.

## Distance bands

Under 2 km "Near you", 2–30 km "Day trip", 30–250 km "Weekend by train", above that "Big trip". Distances are straight-line km, labelled "about".

## Analytics events

`map_viewed`, `title_watched`, `passport_created`, `share_clicked`, `checkin_success`, `postcard_made`, `layla_clicked`, `directions_clicked`, `request_created`, `screenshot_read`, `trip_created`, `trip_joined`, `trip_shared`, `invite_shared`.

## Commands

`npm run dev`, `npm run build`, `npm test`, `npm run seed`, `npm run geocode`

## Skills

- `add-filming-locations`: research and add locations with sources
- `share-card`: design and generation rules for the passport card and postcard
- `screenshot-titles`: Claude vision contract for reading titles from screenshots
- `demo-ready`: checklist before the Sunday demo

## Working style

- Mobile first: judges open the link from a QR code on their phones.
- Ship small working increments; run the app and tests after each change; commit after each milestone.
- Plain, friendly copy. No hype words, no invented numbers.
- If a task would break a product rule above, stop and say so.
