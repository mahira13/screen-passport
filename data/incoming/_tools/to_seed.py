#!/usr/bin/env python3
"""Convert data/incoming/*.csv into seed format v2 (data/seed/README.md) under data/incoming/seed/.

Usage:
  python3 -I data/incoming/_tools/to_seed.py               # convert with cached coordinates only (no network)
  python3 -I data/incoming/_tools/to_seed.py --geocode     # also look up missing places on Nominatim
  python3 -I data/incoming/_tools/to_seed.py --geocode --refresh-cache

Only rows with filmed_or_setting = filmed are converted; private homes and closed sets are left out
(product rule 7). Nothing outside data/incoming/ is written. Stdlib only (Python 3.9+).
Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/ (max 1 request/s, identify yourself).
"""
import csv
import json
import math
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INCOMING = ROOT / "data" / "incoming"
SEED = ROOT / "data" / "seed"
OUT = INCOMING / "seed"
TOOLS = INCOMING / "_tools"
CACHE_FILE = TOOLS / "geocode-cache.json"

LOC_COLUMNS = [
    "id", "work_id", "name", "scene_note", "address", "city", "region", "lat", "lng", "coord_quality",
    "visit_note", "source_name", "source_url", "status", "geocode_query", "country", "country_code",
    "location_confidence", "public_access", "is_filming_location", "merged_into", "aliases",
]
TITLE_COLUMNS = ["id", "title", "type", "aliases", "year"]
LINK_COLUMNS = ["location_id", "work_id", "scene_note", "depicts", "evidence_url", "evidence_name"]

REGION_SPELLING = {"Sachsen": "Saxony"}  # the seed spells Saxony in English; Berlin/Brandenburg are the same
VISIT_NOTE = {"public": "Public", "paid_entry": "Ticketed", "unknown": "Check access before visiting"}
PUBLIC_ACCESS = {"public": "public", "paid_entry": "public", "unknown": "unknown"}
# Same place under two names in the incoming files (normalised name -> normalised name it belongs to).
SAME_PLACE = {"hotel de rome rooftop terrace": "hotel de rome"}

# lib/geocode.ts COARSE: areas and streets, never a single place.
COARSE = {
    "city", "town", "village", "hamlet", "municipality", "county", "state", "region", "district",
    "city_district", "borough", "suburb", "quarter", "neighbourhood", "administrative", "postcode", "road",
}
AREA_CLASSES = {"leisure", "landuse", "natural", "waterway"}
STREETLIKE = re.compile(r"(straße|strasse|str\.|platz|markt|allee|ufer|gracht|damm|weg|chaussee|ring|brücke|bridge|kirchhof|hafen|\bpark\b|garten|viertel|tunnel)", re.I)
DE_BOX = (47.2, 55.1, 5.8, 15.1)
CITY_RADIUS_KM = {"Berlin": 25.0}
DEFAULT_RADIUS_KM = 12.0
DELAY_S = 1.1
# Reviewed by hand against the OSM result (see GEOCODE_REPORT.md). "reject": the hit is a different place;
# ("approx", confidence): the hit is right next to the place but not the place itself.
REVIEWED = {
    ("Park at Schloss Marquardt", "Potsdam"): "reject",          # matched a customs office in Babelsberg
    ("Clipper Boardinghouse, Gendarmenmarkt", "Berlin"): "reject",  # matched another Clipper building
    ("Motel Avus", "Berlin"): "reject",                          # matched "Rasthof AVUS", not clearly the same
    ("Tiergarten Tunnel (Potsdamer Platz exit)", "Berlin"): "reject",  # matched the whole park
    ("Henriette-Herz-Park", "Berlin"): ("approx", "area"),       # matched a bike station in the park
    ("Kuppelhalle, Sportpark", "Berlin"): ("approx", "area"),    # matched an office on the same grounds
    ("Templiner See", "Potsdam"): ("approx", "area"),            # a lake, not a building
}


# ---------------------------------------------------------------- helpers
def read_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def seed_newline(name):
    """The seed files don't agree (titles.csv uses CRLF); match each one so rows can be appended as they are."""
    p = SEED / name
    return "\r\n" if p.exists() and b"\r\n" in p.read_bytes()[:4096] else "\n"


def write_csv(path, columns, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns, lineterminator=seed_newline(path.name))
        w.writeheader()
        w.writerows(rows)


def normalise_title(raw):
    """Python port of lib/match.ts normaliseTitle."""
    s = raw.lower().replace("ß", "ss")
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = re.sub(r"\(\s*\d{4}\s*\)\s*$", "", s)
    s = re.sub(r"['’`]", "", s).replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return re.sub(r"^(the|a|an|der|die|das|le|la|les|el)\s+", "", s)


def normalise_place(raw):
    s = re.sub(r"\(.*?\)", "", raw)  # "Glockenturm, Olympiastadion (exterior)" -> without the bracket
    s = s.lower().replace("ß", "ss")
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return SAME_PLACE.get(s, s)


def slugify(title):
    s = re.sub(r"['’`]", "", title.lower())
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def split_title(title):
    """'The Captain (Der Hauptmann)' -> ('The Captain', ['Der Hauptmann'])."""
    m = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", title)
    if m and not re.fullmatch(r"\d{4}", m.group(2)):
        return m.group(1).strip(), [m.group(2).strip()]
    return title.strip(), []


def km(a_lat, a_lng, b_lat, b_lng):
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def contact():
    env = ROOT / ".env.local"
    if not env.exists():
        return None
    vals = {}
    for line in env.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z_]+)\s*=\s*(.*?)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip("'\"")
    return vals.get("GEOCODER_CONTACT") or vals.get("GEOCODE_CONTACT") or None


# ---------------------------------------------------------------- geocoding
class Geocoder:
    def __init__(self, online, refresh):
        self.online = online
        self.refresh = refresh
        self.cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
        self.requests = 0
        self.last = 0.0
        self.agent = None
        if online:
            c = contact()
            if not c:
                sys.exit("Set GEOCODER_CONTACT (your email or project URL) in .env.local first (Nominatim policy).")
            self.agent = f"ScreenPassport/0.1 ({c})"

    def search(self, q):
        if q in self.cache and not self.refresh:
            return self.cache[q]
        if not self.online:
            return None
        wait = DELAY_S - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        params = urllib.parse.urlencode({"q": q, "format": "jsonv2", "addressdetails": "1", "limit": "1", "countrycodes": "de"})
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": self.agent, "Accept-Language": "de,en"},
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            hits = json.loads(res.read().decode("utf-8"))
        self.last = time.time()
        self.requests += 1
        hit = hits[0] if hits else None
        keep = None
        if hit:
            keep = {k: hit.get(k) for k in ("lat", "lon", "display_name", "category", "type", "addresstype", "name", "address")}
        self.cache[q] = keep
        CACHE_FILE.write_text(json.dumps(self.cache, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        return keep

    def city_centre(self, city):
        hit = self.search(f"{city}, Deutschland")
        return (float(hit["lat"]), float(hit["lon"])) if hit else None


def classify(hit, name):
    """(coord_quality, location_confidence) for an accepted hit, or None if too vague."""
    cat, typ, addr = hit.get("category"), hit.get("type"), hit.get("addresstype")
    streetlike = bool(STREETLIKE.search(name))
    coarse = cat == "boundary" or (cat == "place" and typ in COARSE) or (addr in COARSE)
    if cat == "highway" or addr == "road" or (cat == "place" and typ == "square"):
        return ("approx", "street") if streetlike else None
    if coarse:
        return None
    if cat in AREA_CLASSES:
        return ("approx", "area")
    return ("geocoded", "building")


def in_city(hit, city, centre):
    lat, lng = float(hit["lat"]), float(hit["lon"])
    if not (DE_BOX[0] <= lat <= DE_BOX[1] and DE_BOX[2] <= lng <= DE_BOX[3]):
        return False
    a = hit.get("address") or {}
    names = {a.get(k) for k in ("city", "town", "village", "municipality")}
    if city in names:
        return True
    return bool(centre) and km(lat, lng, *centre) <= CITY_RADIUS_KM.get(city, DEFAULT_RADIUS_KM)


def queries_for(name, address, city):
    clean = re.sub(r"\s*\(.*?\)", "", name).strip()
    qs = []
    if address and not address.lower().startswith(("corner of", "north side")):
        qs.append(f"{clean}, {address}, {city}")
    qs.append(f"{clean}, {city}")
    if address and re.search(r"\d", address):
        qs.append(f"{address}, {city}")
    # Simpler fallbacks for compound names Nominatim doesn't understand:
    # "Neues Palais, Sanssouci" -> "Neues Palais"; "Spittelmarkt at Leipziger Straße" -> "Spittelmarkt";
    # "Former Landtag building, Brauhausberg" -> "Brauhausberg" is too vague, so only the first part is tried
    # unless the first part is generic.
    parts = [p.strip() for p in re.split(r",| at ", clean) if p.strip()]
    if len(parts) > 1:
        first = re.sub(r"^(former|the)\s+", "", parts[0], flags=re.I)
        qs.append(f"{first}, {city}")
        qs.append(f"{parts[1]} {first}, {city}" if len(first.split()) <= 2 else f"{parts[1]}, {city}")
    return list(OrderedDict.fromkeys(qs))


# ---------------------------------------------------------------- main
def main():
    online = "--geocode" in sys.argv
    refresh = "--refresh-cache" in sys.argv
    check = subprocess.run([sys.executable, "-I", str(TOOLS / "check.py")], capture_output=True, text=True)
    if check.returncode != 0:
        sys.exit("check.py failed; fix the incoming files first:\n" + check.stdout)

    seed_titles = read_csv(SEED / "titles.csv")
    seed_locs = read_csv(SEED / "locations.csv")
    seed_links = read_csv(SEED / "location_works.csv") if (SEED / "location_works.csv").exists() else []
    seed_loc_by_id = {r["id"]: r for r in seed_locs}
    title_index = {}
    for t in seed_titles:
        for n in [t["title"], *filter(None, t["aliases"].split("|"))]:
            title_index.setdefault(normalise_title(n), t["id"])
    work_ids = {t["id"] for t in seed_titles}
    # (location id, work id) pairs the seed already has
    have_pair = {(r["id"], r["work_id"]) for r in seed_locs} | {(r["location_id"], r["work_id"]) for r in seed_links}
    # Seed places by normalised name + city, following merged_into
    seed_place_index = {}
    for r in seed_locs:
        target = r["merged_into"] or r["id"]
        seed_place_index.setdefault((normalise_place(r["name"]), r["city"]), target)

    files = sorted(p for p in INCOMING.glob("*.csv") if p.name != "_needs_source.csv")
    rows, skipped = [], []
    for p in files:
        for i, r in enumerate(read_csv(p), start=2):
            r["_where"] = f"{p.name}:{i}"
            if r["filmed_or_setting"] != "filmed":
                skipped.append((r, f"filmed_or_setting = {r['filmed_or_setting']}"))
            elif r["access"] in ("private", "closed_set"):
                skipped.append((r, f"access = {r['access']} (rule 7)"))
            else:
                rows.append(r)

    # ---- titles
    new_titles = OrderedDict()
    for r in rows:
        if r["work_id"]:
            r["_wid"] = r["work_id"]
            continue
        title, aliases = split_title(r["title"])
        key = normalise_title(title)
        wid = title_index.get(key) or next((title_index[normalise_title(a)] for a in aliases if normalise_title(a) in title_index), None)
        if not wid:
            wid = slugify(title)
            base, n = wid, 2
            while wid in work_ids and wid not in new_titles:
                wid, n = f"{base}-{n}", n + 1
            if wid not in new_titles:
                # Series: the year on a page is often a season or shoot year, so leave it to `npm run tmdb`.
                year = r["year"] if r["type"] == "film" else ""
                new_titles[wid] = {"id": wid, "title": title, "type": r["type"], "aliases": "|".join(aliases), "year": year}
            elif not new_titles[wid]["year"] and r["year"] and r["type"] == "film":
                new_titles[wid]["year"] = r["year"]
            title_index.setdefault(key, wid)
        r["_wid"] = wid
    all_work_ids = work_ids | set(new_titles)

    # ---- places
    geo = Geocoder(online, refresh)
    next_id = max(int(r["id"]) for r in seed_locs) + 1
    new_locs = OrderedDict()  # (normalised name, city) -> locations row
    links, link_pairs = [], set()
    duplicates = []
    centres = {}

    def add_link(loc_id, r):
        pair = (str(loc_id), r["_wid"])
        if pair in have_pair or pair in link_pairs:
            duplicates.append((r, f"location {loc_id} already has {r['_wid']}"))
            return
        link_pairs.add(pair)
        links.append({"location_id": str(loc_id), "work_id": r["_wid"], "scene_note": r["scene_note"], "depicts": "",
                      "evidence_url": r["source_url"], "evidence_name": r["source_name"]})

    geocode_report = []
    for r in rows:
        mid = r["existing_match_id"]
        if mid:
            target = seed_loc_by_id[mid]["merged_into"] or mid
            add_link(target, r)
            continue
        key = (normalise_place(r["name"]), r["city"])
        if key in seed_place_index:
            add_link(seed_place_index[key], r)
            continue
        if key in new_locs:
            loc = new_locs[key]
            if (loc["id"], r["_wid"]) in {(loc["id"], loc["work_id"])}:
                duplicates.append((r, f"new place {loc['id']} already has {r['_wid']}"))
            else:
                add_link(loc["id"], r)
            continue
        region = REGION_SPELLING.get(r["region"], r["region"])
        loc = {
            "id": str(next_id), "work_id": r["_wid"], "name": r["name"], "scene_note": r["scene_note"],
            "address": r["address"], "city": r["city"], "region": region, "lat": "", "lng": "", "coord_quality": "",
            "visit_note": VISIT_NOTE[r["access"]], "source_name": r["source_name"], "source_url": r["source_url"],
            "status": "unverified", "geocode_query": "", "country": "Germany", "country_code": "DE",
            "location_confidence": "", "public_access": PUBLIC_ACCESS[r["access"]], "is_filming_location": "true",
            "merged_into": "", "aliases": "",
        }
        next_id += 1
        new_locs[key] = loc
        qs = queries_for(r["name"], r["address"], r["city"])
        loc["geocode_query"] = qs[0] + ", Germany"
        if r["lat"] and r["lng"]:
            loc.update(lat=r["lat"], lng=r["lng"], coord_quality="source", location_confidence="building")
            continue
        if r["city"] not in centres:
            centres[r["city"]] = geo.city_centre(r["city"])
        note = "no result"
        for q in qs:
            hit = geo.search(q)
            if not hit:
                continue
            if not in_city(hit, r["city"], centres[r["city"]]):
                note = f"result outside {r['city']}: {hit.get('display_name')}"
                continue
            cls = classify(hit, r["name"])
            review = REVIEWED.get((r["name"], r["city"]))
            if review == "reject":
                note = f"rejected on review: {hit.get('display_name')}"
                break
            if review and cls:
                cls = review
            if not cls:
                note = f"too vague ({hit.get('category')}/{hit.get('type')}): {hit.get('display_name')}"
                continue
            loc.update(lat=f"{float(hit['lat']):.6f}", lng=f"{float(hit['lon']):.6f}", coord_quality=cls[0],
                       location_confidence=cls[1], geocode_query=q + ", Germany")
            break
        if not loc["lat"]:
            if not online and not any(q in geo.cache for q in qs):
                note = "not looked up yet (run with --geocode)"
            geocode_report.append((loc, note))

    # ---- validate (port of scripts/seed-rows.ts validateSeed, for the new rows)
    problems = []
    seen_ids = {r["id"] for r in seed_locs}
    out_locs = list(new_locs.values())
    for l in out_locs:
        w = f"location {l['id']} ({l['name']})"
        if l["id"] in seen_ids:
            problems.append(f"{w}: id clashes with the seed")
        seen_ids.add(l["id"])
        if l["work_id"] not in all_work_ids:
            problems.append(f"{w}: unknown work {l['work_id']}")
        if not re.match(r"^https?://", l["source_url"]) or re.search(r"(wikipedia|wikidata|wikia|fandom)\.", l["source_url"]):
            problems.append(f"{w}: bad source_url")
        if bool(l["lat"]) != bool(l["coord_quality"]):
            problems.append(f"{w}: coordinates and coord_quality must go together")
        if not l["lat"] and not l["geocode_query"]:
            problems.append(f"{w}: no coordinates and no geocode_query")
    all_loc_ids = {r["id"] for r in seed_locs} | {l["id"] for l in out_locs}
    for k in links:
        w = f"location_works {k['location_id']}/{k['work_id']}"
        if k["location_id"] not in all_loc_ids:
            problems.append(f"{w}: unknown location")
        if k["work_id"] not in all_work_ids:
            problems.append(f"{w}: unknown work")
    if problems:
        sys.exit("Output has problems:\n- " + "\n- ".join(problems))

    # ---- write
    OUT.mkdir(exist_ok=True)
    write_csv(OUT / "locations.csv", LOC_COLUMNS, out_locs)
    write_csv(OUT / "titles.csv", TITLE_COLUMNS, list(new_titles.values()))
    write_csv(OUT / "location_works.csv", LINK_COLUMNS, links)

    q = {k: sum(1 for l in out_locs if l["coord_quality"] == k) for k in ("source", "geocoded", "approx")}
    missing = sum(1 for l in out_locs if not l["lat"])
    lines = ["# Skipped rows", "", "Not converted to seed format. They stay in the city files as leads.", "",
             "| row | title | place | reason |", "|---|---|---|---|"]
    lines += [f"| {r['_where']} | {r['title']} | {r['name']} | {why} |" for r, why in skipped + duplicates]
    (OUT / "SKIPPED.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    lines = ["# Places without coordinates", "",
             "These keep an empty lat/lng and a geocode_query; set them by hand in /admin/locations after import.", "",
             "| id | place | city | why |", "|---|---|---|---|"]
    lines += [f"| {l['id']} | {l['name']} | {l['city']} | {why.replace('|', '/')} |" for l, why in geocode_report]
    (OUT / "GEOCODE_REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    readme = f"""# Seed-format export of data/incoming

Generated by `python3 -I data/incoming/_tools/to_seed.py` (add `--geocode` to look up new places).
Do not edit these files by hand; change the city CSVs and run the script again.

- `locations.csv`: {len(out_locs)} new places (ids {out_locs[0]['id'] if out_locs else '-'}–{out_locs[-1]['id'] if out_locs else '-'}), all `unverified`
  - coordinates: {q['source']} from the source, {q['geocoded']} geocoded (building), {q['approx']} approximate (street, square or park), {missing} missing (see GEOCODE_REPORT.md)
- `titles.csv`: {len(new_titles)} new titles
- `location_works.csv`: {len(links)} extra title links ({sum(1 for k in links if k['location_id'] in {r['id'] for r in seed_locs})} to existing seed places)
- `SKIPPED.md`: {len(skipped)} rows not converted (unclear, setting only, private, closed set) and {len(duplicates)} duplicates

Coordinates come from OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL). `geocoded` and `approx`
never enable check-in; that needs `source` or `verified`.

## Merging into data/seed

1. Append the rows (without the header) of each file to the file of the same name in `data/seed/`,
   e.g. `tail -n +2 data/incoming/seed/titles.csv >> data/seed/titles.csv`. Each file already uses the same
   line endings as its seed file (`titles.csv` is CRLF, the others LF); mixing them breaks the CSV parser.
   The ids continue after the seed's last id, so they don't clash as long as `data/seed/locations.csv` hasn't
   grown since this export (re-run the script if it has).
2. `npm run seed -- --dry-run` must report no problems.
3. `npm run seed` loads them as drafts; `npm run verify` or /admin/locations decides what goes live.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print(readme.split("## Merging")[0].strip())
    print(f"\nNominatim requests this run: {geo.requests}")


if __name__ == "__main__":
    main()
