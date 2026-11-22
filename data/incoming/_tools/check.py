#!/usr/bin/env python3
"""Check data/incoming/*.csv against data/incoming/FORMAT.md.

Run from anywhere: python3 -I data/incoming/_tools/check.py
Exits 1 and lists every problem if any row is invalid. Stdlib only (Python 3.9+).
"""
import csv
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
INCOMING = ROOT / "data" / "incoming"
TRUSTED_TS = ROOT / "lib" / "trusted-sources.ts"
SEED_LOCATIONS = ROOT / "data" / "seed" / "locations.csv"
SEED_TITLES = ROOT / "data" / "seed" / "titles.csv"
NEEDS_SOURCE = "_needs_source.csv"

COLUMNS = [
    "title", "work_id", "type", "year", "name", "address", "city", "region", "lat", "lng",
    "scene_note", "source_name", "source_url", "source_quote", "source_domain",
    "filmed_or_setting", "access", "existing_match_id", "existing_match", "collector", "collected_at",
]
REQUIRED = [
    "title", "type", "name", "city", "region", "scene_note", "source_name", "source_url",
    "source_quote", "source_domain", "filmed_or_setting", "access", "collector", "collected_at",
]
ENUMS = {
    "type": {"film", "series"},
    "filmed_or_setting": {"filmed", "setting_only", "unclear"},
    "access": {"public", "paid_entry", "private", "closed_set", "unknown"},
}
STATES = {
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen",
    "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz",
    "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
}
BANNED_DOMAINS = ("wikipedia.org", "wikidata.org", "fandom.com", "imdb.com")
DE_BOX = (47.2, 55.1, 5.8, 15.1)  # lat min, lat max, lng min, lng max
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*\.csv$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def trusted_domains():
    text = TRUSTED_TS.read_text(encoding="utf-8")
    block = re.search(r"TRUSTED_DOMAINS\s*=\s*\[(.*?)\]\s*as const", text, re.S)
    if not block:
        sys.exit(f"Could not find TRUSTED_DOMAINS in {TRUSTED_TS}")
    body = re.sub(r"//[^\n]*", "", block.group(1))
    domains = re.findall(r'"([^"]+)"', body)
    if not domains:
        sys.exit("TRUSTED_DOMAINS is empty")
    return domains


def host_of(url):
    try:
        u = urlparse(url)
    except ValueError:
        return None
    if u.scheme not in ("http", "https") or not u.hostname:
        return None
    return u.hostname.lower().rstrip(".")


def on_list(host, domains):
    return any(host == d or host.endswith("." + d) for d in domains)


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return reader.fieldnames or [], list(reader)


def main():
    domains = trusted_domains()
    _, seed_locs = read_csv(SEED_LOCATIONS)
    seed_ids = {r["id"]: r["name"] for r in seed_locs}
    _, seed_titles = read_csv(SEED_TITLES)
    work_ids = {r["id"] for r in seed_titles}

    errors = []
    seen = {}
    counts = {}
    files = sorted(p for p in INCOMING.glob("*.csv"))
    for path in files:
        fname = path.name
        is_needs = fname == NEEDS_SOURCE
        if not is_needs and not SLUG.match(fname):
            errors.append(f"{fname}: file name must be an ASCII city slug, e.g. goerlitz.csv")
        header, rows = read_csv(path)
        if header != COLUMNS:
            errors.append(f"{fname}: header must be exactly: {','.join(COLUMNS)}")
            continue
        counts[fname] = len(rows)
        for i, r in enumerate(rows, start=2):
            where = f"{fname}:{i}"

            def err(msg):
                errors.append(f"{where}: {msg}")

            for c in REQUIRED:
                if not (r.get(c) or "").strip():
                    err(f"{c} is empty")
            for c, allowed in ENUMS.items():
                if r[c] and r[c] not in allowed:
                    err(f"{c}={r[c]!r} not in {sorted(allowed)}")
            if r["region"] and r["region"] not in STATES:
                err(f"region={r['region']!r} is not a German state")
            if r["work_id"] and r["work_id"] not in work_ids:
                err(f"work_id={r['work_id']!r} not in data/seed/titles.csv")
            if r["year"] and not re.fullmatch(r"(18|19|20)\d\d", r["year"]):
                err(f"year={r['year']!r} is not a year")
            if r["collected_at"] and not DATE.match(r["collected_at"]):
                err("collected_at must be YYYY-MM-DD")

            words = len(r["source_quote"].split())
            if words > 25:
                err(f"source_quote has {words} words (max 25)")

            host = host_of(r["source_url"])
            if r["source_url"] and not host:
                err("source_url is not an http(s) URL")
            elif host:
                bare = host[4:] if host.startswith("www.") else host
                if r["source_domain"] and r["source_domain"] != bare:
                    err(f"source_domain={r['source_domain']!r} but URL host is {bare!r}")
                if any(host == d or host.endswith("." + d) for d in BANNED_DOMAINS):
                    err(f"{bare} is never a valid source (move the lead to {NEEDS_SOURCE} with another URL)")
                elif not is_needs and not on_list(host, domains):
                    err(f"{bare} is not in lib/trusted-sources.ts (move the row to {NEEDS_SOURCE})")

            lat, lng = r["lat"].strip(), r["lng"].strip()
            if bool(lat) != bool(lng):
                err("lat and lng must both be set or both empty")
            elif lat:
                try:
                    la, ln = float(lat), float(lng)
                    if not (DE_BOX[0] <= la <= DE_BOX[1] and DE_BOX[2] <= ln <= DE_BOX[3]):
                        err(f"{la},{ln} is outside Germany")
                except ValueError:
                    err("lat/lng are not numbers")
            if r["access"] == "private" and (r["address"] or lat or lng):
                err("private place: address, lat and lng must be empty")

            mid = r["existing_match_id"].strip()
            if mid:
                if mid not in seed_ids:
                    err(f"existing_match_id={mid} not in data/seed/locations.csv")
                elif r["existing_match"] and r["existing_match"] != seed_ids[mid]:
                    err(f"existing_match should be {seed_ids[mid]!r} for id {mid}")

            key = (r["title"].strip().lower(), r["name"].strip().lower(), r["city"].strip().lower())
            if key in seen:
                err(f"duplicate of {seen[key]} (title, name, city)")
            else:
                seen[key] = where

    for fname, n in counts.items():
        print(f"{fname}: {n} rows")
    if errors:
        print(f"\n{len(errors)} problem(s):")
        for e in errors:
            print("  " + e)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
