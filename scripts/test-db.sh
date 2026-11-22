#!/bin/sh
# Runs the database tests against a throwaway local PostGIS container (needs Docker).
# Applies migrations 001–006, loads the seed as the old schema had it, applies 007 (so its
# backfill runs on real data), then runs tests/db. Never touches the Supabase project.
set -eu
NAME=screen-passport-testdb
PORT=54329
IMAGE=postgis/postgis:16-3.4
cd "$(dirname "$0")/.."

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --rm --platform linux/amd64 --name "$NAME" -e POSTGRES_PASSWORD=test -p "$PORT:5432" "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
until docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; do sleep 1; done
sleep 1

psql_run() { docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

# What a Supabase project already has: the API roles. The image pre-installs PostGIS in
# public; drop it so 007 installs it into the extensions schema, as on Supabase.
psql_run <<'SQL'
drop extension if exists postgis_tiger_geocoder, postgis_topology, fuzzystrmatch, postgis cascade;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
SQL

for f in 001_init 002_passport_edit_key 003_repair_and_grants 004_trips 005_trip_safety 006_invite_event; do
  psql_run < "supabase/migrations/$f.sql"
done

export TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:$PORT/postgres"
npx tsx tests/db/load-legacy.ts
psql_run < supabase/migrations/007_catalogue.sql
psql_run < supabase/migrations/007_catalogue.sql # safe to run twice
npx vitest run tests/db
