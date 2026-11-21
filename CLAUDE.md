# Screen Passport

Collect the places your favourite films and series were shot. Visit them, stamp them, share them.

Open the link and within seconds you see what was filmed near you. Tap "Watched it" on the titles you've seen and your Screen Passport fills with stamps. Check in on site to turn a stamp gold, frame your own photo as a scene postcard, and share your passport as an Instagram story. "Create a trip" turns your titles into a dated fan trip that friends can join; "Plan travel and stays with Layla" hands the rest over to Layla.

Built at the Layla Build & Launch Hackathon, Berlin, 21–22 Nov 2026. Feature freeze Sunday 14:00, submission 15:30 (live link, 3 slides, real numbers).

## The idea changed (read this first)

This repo started as a Spotify-based concept: connect Spotify, a listening summary, a "vibe" page and people nearby (see the old `claude.md` on `main` and the `bogdan/initial_version` branch). The team refactored the idea into **Screen Passport**: films and series instead of music, filming locations instead of listening data, fan trips instead of people nearby.

- This file is the source of truth. The old `claude.md` and its Spotify features are superseded; don't build on them.
- No Spotify, Netflix or other account connections (see product rule 1). Titles come from taps, search over our own database, or a screenshot.
- Code from the old branch is not reused here; Screen Passport has its own stack and data model below.

## Product rules (read before changing anything)

1. **Instant value, no downloads.** The first screen shows filming locations near the user with zero input. No login, no CSV upload, no Netflix connection (Netflix has no public API; never ask for passwords or scrape accounts).
2. **Ways in, in order:** near-me map → "Watched it" taps on title cards → search box that only selects titles from our database → optional screenshot upload where Claude reads titles. Free text that matches nothing becomes a request, never an AI answer.
3. **Every location has a source.** No row in `locations` without `source_url`. Trusted sources: official tourism and city sites, established location guides and major media (see the add-filming-locations skill); not Wikipedia or fan wikis. Claude never invents locations, coordinates or scenes. Only `status = 'live'` locations are shown.
4. **Code for facts, Claude for words and images.** Distance, sorting, matching, check-in radius, collections and which stops a trip has (and their order) are plain code. Claude is used only to read titles from screenshots, for fuzzy title matching, to research requested titles (saved as `unverified` for human approval), and to write a trip's title, intro, stop times, travel steps, "why fans love it" and tips. For trips Claude gets only the chosen live locations, must use only their IDs and never adds places, prices or opening hours; every returned location ID is checked in code, with one retry and then a plain code-built plan.
5. **Privacy:** no accounts, no emails, no raw uploads stored. Screenshots are read and discarded. Postcard photos are composed in the browser and never uploaded unless the user shares them. Passports store only title IDs, location IDs, start city and an optional display name. Trips store title IDs, the start label and point, mode, length, date and time with its time zone, meeting point, the plan, and first names only (organiser and people who join). Rate limits and reports store only a salted sha256 of the IP (`RATE_LIMIT_SALT`), never the raw IP. Trips and joins are read and written only through server routes with the service role key; no public RLS policies. Trip pages carry a short safety note (meet in public, no personal details needed).
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
- "I'm here" check-in: browser geolocation within 200 m of a location → gold stamp. Only offered where `coord_quality` is `source` or `verified`; geocoded or approximate points can be kilometres off (a district search returns the district centre)
- Scene postcard: user photo + frame (title, place, "Filmed here") composed client-side
- Location card actions: Directions (Google Maps), Source link, "Plan the rest with Layla" (opens Layla; copies a ready prompt to clipboard)
- Requests table for unknown titles; admin page to approve researched locations
- Trips: `/trip/new?works=<ids>&from=<lat,lng or city>` (mode walk/transit/car, half or full day, date and time, first name) → `/trip/[id]` with numbered stops on a map and in a list, "Open all in Google Maps" (up to 9 waypoints), Layla handoff, Join (first name, max 30 characters, max 50 joins), Web Share and Open Graph preview. Stops: live locations of the chosen works within 30 km (walk), 60 km (transit) or 150 km (car) of the start, ordered nearest-next-stop, up to 8 (half day 4–5). "Create a trip" on each title card and on the passport
- Trip safety (per-IP limits are skipped in `npm run dev` and with `RATE_LIMITS=off` for testing; never set that in production): /api/trip max 5 trips per IP per day; at most 300 Claude trip plans per day in total, then the code-built plan; joins max 20 per IP per day and 50 per trip; friendly messages when a limit is hit. No links or offensive words in first names, trip titles, meeting points or any Claude text. "Report this trip" hides a trip after 3 reports (one per IP). The organiser gets a secret link (`/trip/[id]#key=…`, key kept in localStorage) to delete the trip.
- Trip times are shown in the trip's time zone with its city ("10:00 London time"): the picked city's `tz`, or the browser's zone when the user shared their location
- Trip invite card on `/trip/[id]`: "Now showing" story image (1080×1920, share-card colours and fonts) with trip title, film titles as plain text, date and time with the zone's city, "Venue" (meeting point), stops, "Seats left" (50 minus joins) and the trip link; Web Share with download fallback; copies the link for the story link sticker; "Copy caption" adds the film hashtags
- `/impressum` and `/privacy`, linked from every page
- Analytics events

**Nice to have:** screenshot upload (Claude vision reads titles), compare passports with a friend, show pages `/t/[id]`.

**Out:** login, Netflix/Spotify connections, travel and stays booking (Layla does that), books, native app, live prices, opening hours.

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
    trip/new/page.tsx            # create a trip
    trip/[id]/page.tsx           # a trip: stops, map, join, share
    t/[id]/page.tsx              # title page: where it was filmed (nice to have)
    admin/requests/page.tsx      # approve researched requests (ADMIN_PASSWORD)
    api/nearby/route.ts          # live locations sorted by distance
    api/passport/route.ts        # create/update passport -> id
    api/request/route.ts         # unknown title -> requests (+count)
    api/trip/route.ts            # create a trip (Claude writes the words) -> id
    api/trip/[id]/join/route.ts  # join a trip with a first name
    api/read-screenshot/route.ts # Claude vision -> {titles: []} (nice to have)
  components/
    CityPicker.tsx  NearbyMap.tsx  TitleCard.tsx  LocationCard.tsx
    PassportBar.tsx  ShareCard.tsx  Collections.tsx  CheckInButton.tsx
    PostcardMaker.tsx  TitleSearch.tsx  ScreenshotUpload.tsx
  lib/
    distance.ts      # haversine, distance bands
    match.ts         # normalise + alias matching
    cities.ts        # German start cities with coordinates and time zone
    collections.ts   # progress calculation
    layla.ts         # Layla handoff prompt + link
    route.ts         # nearest-next-stop order, total km, Google Maps route link
    trip.ts          # trip stop selection, plan validation, fallback plan, time zones
    moderation.ts    # no links or offensive words in public text
    rate-limit.ts    # daily limits via the take_rate database function
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
- `trips(id text pk, title, intro, work_ids text[], start_label, start_lat, start_lng, mode ['walk','transit','car'], length ['half','full'], starts_at timestamptz, timezone, meeting_point, organiser_name, plan jsonb, delete_key_hash, hidden_at, created_at)`
- `trip_joins(id serial pk, trip_id fk, first_name, created_at)`
- `trip_reports(trip_id fk, ip_hash, created_at, pk(trip_id, ip_hash))`, `rate_events(id, bucket, key_hash, created_at)` (rows older than 2 days are deleted)

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
