# Seed CSVs (format v2)

`npm run seed` upserts these files by id (`location_works.csv` by location and title). It never
publishes: new places arrive as `draft`, existing places keep their verification status, checked
coordinates and catalogue fields, and places merged away in the database are left alone.
`npm run seed -- --dry-run` only validates.

- `titles.csv`: `id, title, type (film|series), aliases (pipe-separated), year`. An empty year or
  missing alias keeps what the database has (e.g. filled by `npm run tmdb`).
- `locations.csv`: the v1 columns (`id, work_id, name, scene_note, address, city, region, lat, lng,
  coord_quality, visit_note, source_name, source_url, status, geocode_query`) plus optional
  `country, country_code, location_confidence (exact|building|street|area),
  public_access (public|exterior_only|restricted|unknown), is_filming_location (true|false),
  merged_into`. Empty means "keep the database value" (new rows: Germany/DE, unknown, true).
  `status` must be `unverified`; places go live in `/admin/locations` or through `npm run verify`.
- `location_works.csv`: extra titles at a place, `location_id, work_id, scene_note, depicts,
  evidence_url, evidence_name`. Each link needs its own trusted evidence URL.
- `collections.csv`: `id, name, city, work_ids (pipe-separated), description`.

Sources follow product rule 3 in CLAUDE.md: no Wikipedia, Wikidata or fan wikis.
