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
psql_run < supabase/migrations/008_verification.sql
psql_run < supabase/migrations/008_verification.sql # safe to run twice
psql_run < supabase/migrations/009_images.sql
psql_run < supabase/migrations/009_images.sql # safe to run twice
for f in 010_featured_collections 011_search_normalise 012_featured_ranks 013_location_aliases_outline 014_pipeline 015_challenges 016_hardening; do
  psql_run < "supabase/migrations/$f.sql"
  psql_run < "supabase/migrations/$f.sql" # safe to run twice
done
npx vitest run tests/db

# Rollback: back to the 001–006 schema, the old view still serves the app, and 007 applies again.
psql_run < supabase/rollback/007_catalogue_down.sql
psql_run -At <<'SQL' | tee /dev/stderr | grep -qx "ok"
select case when to_regclass('public.location_works') is null
             and to_regclass('public.catalogue_entries') is null
             and not exists (select 1 from information_schema.columns where table_name = 'locations' and column_name = 'verification_status')
             and (select count(*) from mappable_locations) > 0
             and exists (select 1 from pg_policies where policyname = 'live locations are public')
            then 'ok' else 'rollback incomplete' end;
SQL
psql_run < supabase/migrations/007_catalogue.sql
psql_run < supabase/migrations/008_verification.sql
psql_run < supabase/migrations/009_images.sql
psql_run < supabase/migrations/010_featured_collections.sql
psql_run < supabase/migrations/011_search_normalise.sql
psql_run < supabase/migrations/012_featured_ranks.sql
psql_run < supabase/migrations/013_location_aliases_outline.sql
echo "rollback and re-apply: ok"
