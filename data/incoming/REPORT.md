# data/incoming report

Generated from the CSVs. Counts are rows (one title at one place).

| city file | rows | filmed | setting_only | unclear | private | closed_set | new title at a seed place | needs_source (same city) |
|---|---|---|---|---|---|---|---|---|
| berlin.csv | 83 | 69 | 6 | 8 | 4 | 0 | 21 | 0 |
| dresden.csv | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| goerlitz.csv | 36 | 35 | 0 | 1 | 2 | 0 | 12 | 0 |
| leipzig.csv | 9 | 6 | 1 | 2 | 0 | 0 | 0 | 0 |
| potsdam.csv | 66 | 64 | 0 | 2 | 2 | 6 | 1 | 0 |
| **total** | 197 | 176 | 8 | 13 | 8 | 6 | 34 | 0 |

## Sources used most

- movie-locations.com: 66 rows
- potsdam.de: 62 rows
- goerlitz.de: 36 rows
- visitberlin.de: 16 rows
- berlin.de: 10 rows
- mdm-online.de: 7 rows

## Notes

- Every row comes from a page fetched on 2026-11-22; quotes were copied from the fetched text. No page gave
  coordinates, so `lat`/`lng` are empty everywhere and need `npm run geocode` (or a teammate) after import.
- Places already in `data/seed/locations.csv` for the **same title** were skipped. A **new title** at a seed place
  is kept with `existing_match_id`, so the import can add it as a `location_works` link instead of a new place.
- `private` rows (homes, offices) have no address or coordinates on purpose (rule 7); they exist only so the
  pipeline knows to exclude them. Three private rows' quotes were cut so they don't contain a house number.
- `unclear` rows: the page describes a scene at the place but doesn't say it was shot there. They need a second source.
- Not usable: movie-locations.com's Aeon Flux page returned 403. Demolished places (Deutschlandhalle, the
  Bourne Supremacy "CIA hub" office block) were left out.
- Spot check: 12 quotes across all sources were re-fetched independently; 11 matched on the first try. One
  Görlitz quote had been credited to the wrong goerlitz.de page; three rows were corrected to
  `Walk-of-Goerliwood.html`, where the sentence was found.
- Skipped on purpose: lines where the fetch tool only returned a summary of the page (reiseland-brandenburg.de
  film pages, two leipzig.de pages), lines with no quote, and potsdam.de's general list of films "made at
  Babelsberg" (no place given). Studio Babelsberg rows are kept as `closed_set` only where a quote ties a title to it.
- Leipzig and Dresden are thin (9 and 3 rows). MDM drehreport pages mostly name only the city. A better
  next source would be the MDM location guide, place by place.
- Possible duplicate to check: Görlitz "Georgsbrunnen" (Inglourious Basterds, goerlitz.de) vs seed id 52
  "Neptunbrunnen Görlitz" (same film). Left unmatched because the names differ.
- Two Leipzig/Halle Airport rows have city Schkeuditz but sit in `leipzig.csv` (the airport serves Leipzig).

## Domains worth adding / access problems

- These trusted domains block automated fetching, so no rows came from them: spiegel.de, zeit.de, faz.net,
  sueddeutsche.de, welt.de, mdr.de, rbb24.de, dw.com. `npm run verify` may hit the same wall.
- For the next cities the trusted list has no official tourism or city site for: Quedlinburg / Saxony-Anhalt,
  Rothenburg ob der Tauber, Bamberg, Weimar (city), Heidelberg (city), Lübeck (city), Wismar, Stralsund,
  Nuremberg, Schwangau, Bisingen. Rows from those towns will land in `_needs_source.csv` unless the
  state boards (bayern.by, tourismus-bw.de, thueringen-entdecken.de, sh-tourismus.de, auf-nach-mv.de) or
  movie-locations.com cover them.
