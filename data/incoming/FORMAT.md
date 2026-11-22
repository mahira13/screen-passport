# data/incoming: format

Filming-location rows collected for later import. Nothing here is live: the import turns rows into
`draft` places and `npm run verify` (or a teammate in /admin/locations) decides what gets published.

- One file per city: `data/incoming/<city-slug>.csv` (ASCII, lowercase, hyphens: `berlin`, `goerlitz`,
  `munich`, `cologne`, `rothenburg-ob-der-tauber`).
- `_needs_source.csv`: good finds whose only source is not on the trusted list. Same columns.
- UTF-8, comma-separated, RFC 4180 quoting, header row exactly as below, in this order.
- One row = one title at one place. A place used by three titles is three rows.

## Columns

| column | required | values / notes | seed v2 equivalent |
|---|---|---|---|
| `title` | yes | Title as released (English if there is one) | `titles.title` |
| `work_id` | no | Only if the title already exists in `data/seed/titles.csv`, else empty | `work_id` |
| `type` | yes | `film` or `series` | `titles.type` |
| `year` | no | Release year, only if the source or seed gives it | `titles.year` |
| `name` | yes | Place name as visitors know it | `locations.name` |
| `address` | no | Only as given by the source. **Always empty for `access=private`** | `address` |
| `city` | yes | Municipality (Berlin, Potsdam, Görlitz, …) | `city` |
| `region` | yes | One of the 16 German states, German spelling (Berlin, Brandenburg, Sachsen, Bayern, …) | `region` |
| `lat`, `lng` | no | Only if the source page gives them. Never guessed. **Always empty for `access=private`** | `lat`, `lng` (+ `coord_quality=source`) |
| `scene_note` | yes | One sentence in our own words: what was filmed there. No quotes from the film or the page | `scene_note` |
| `source_name` | yes | Publisher, e.g. `visitBerlin`, `Movie-Locations.com` | `source_name` |
| `source_url` | yes | Page that says it was filmed there. Must have been opened by the collector | `source_url` |
| `source_quote` | yes | Short exact text from that page (≤ 25 words) proving filming there. Internal evidence only, never shown in the app | used by `npm run verify` quote check |
| `source_domain` | yes | Host of `source_url` without `www.`; must be on `lib/trusted-sources.ts` (except in `_needs_source.csv`) | — |
| `filmed_or_setting` | yes | `filmed`, `setting_only`, `unclear` | `is_filming_location` (`filmed` → true, `setting_only` → false, `unclear` → review) |
| `access` | yes | `public`, `paid_entry`, `private`, `closed_set`, `unknown` | `public_access`: public → `public`, paid_entry → `public` + visit note "ticketed", private / closed_set → not imported (rule 7), unknown → `unknown` |
| `existing_match_id` | no | `id` from `data/seed/locations.csv` when this place is already there (same place, any title) | links to the existing place (`location_works.csv` for a new title) |
| `existing_match` | no | That seed row's `name`, for readability | — |
| `collector` | yes | Who collected the row | — |
| `collected_at` | yes | `YYYY-MM-DD` | — |

Names from the original brief: `location_name` → `name`, `state` → `region`, `title_type` → `type`
(seed names win where they overlap). `source_name` and `existing_match_id` were added so the import needs no guessing.

## Rules

- Germany only. Real filming locations; story settings are `setting_only`, unsure is `unclear`.
- Private homes and closed studio sets are recorded (so they can be excluded) **without address or coordinates**.
- No images, film stills, script quotes or copied descriptions. `source_quote` is the only copied text.
- No Wikipedia, Wikidata, fan wikis or IMDb as `source_url`. They may point to a lead, which then needs a trusted page.
- Run `python3 -I data/incoming/_tools/check.py` before every commit.
