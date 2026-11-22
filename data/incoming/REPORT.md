# data/incoming report

Generated from the CSVs. Counts are rows (one title at one place).

| city file | rows | filmed | setting_only | unclear | private | closed_set | new title at a seed place | needs_source (same city) |
|---|---|---|---|---|---|---|---|---|
| berlin.csv | 83 | 69 | 6 | 8 | 4 | 0 | 21 | 0 |
| **total** | 83 | 69 | 6 | 8 | 4 | 0 | 21 | 0 |

## Sources used most

- movie-locations.com: 57 rows
- visitberlin.de: 16 rows
- berlin.de: 10 rows

## Notes

- Every row comes from a page fetched on 2026-11-22; quotes were copied from the fetched text. No page gave
  coordinates, so `lat`/`lng` are empty everywhere and need `npm run geocode` (or a teammate) after import.
- Places already in `data/seed/locations.csv` for the **same title** were skipped. A **new title** at a seed place
  is kept with `existing_match_id`, so the import can add it as a `location_works` link instead of a new place.
- `private` rows (homes, offices) have no address or coordinates on purpose (rule 7); they exist only so the
  pipeline knows to exclude them. One private row's quote was cut so it doesn't contain a house number.
- `unclear` rows: the page describes a scene at the place but doesn't say it was shot there. They need a second source.
- Not usable: movie-locations.com's Aeon Flux page returned 403. Demolished places (Deutschlandhalle, the
  Bourne Supremacy "CIA hub" office block) were left out.
