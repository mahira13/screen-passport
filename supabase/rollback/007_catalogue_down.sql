-- Rollback for migration 007_catalogue.sql. Returns the schema to what 001–006 created.
-- Run in the Supabase SQL editor. Takes a backup first (see docs in the PR / scripts/backup-tables.ts).
--
-- What it can't undo on its own:
--  * Merges (merge_locations): passports.visited and trips.plan keep pointing at the surviving
--    location id. That id still exists after rollback, so nothing breaks, but merged-away rows stay
--    hidden (status 'unverified'). To bring them back exactly, restore passports, trips and
--    locations from the backup, or run the optional statement in step 2.
--  * Rows created through location_works only (no work_id): step 3 gives them their first title.

set search_path = public, extensions;
begin;

-- 1. The old public policy back (live rows only).
drop policy if exists "published locations are public" on public.locations;
drop policy if exists "live locations are public" on public.locations;
create policy "live locations are public" on public.locations for select using (status = 'live');

-- 2. Optional, only if places were merged and you want the merged-away rows public again:
-- update public.locations set status = 'live' where merged_into is not null;

-- 3. work_id is required again.
update public.locations l
   set work_id = (select min(lw.work_id) from public.location_works lw where lw.location_id = l.id)
 where l.work_id is null;
delete from public.locations where work_id is null; -- only rows that never had a title
alter table public.locations alter column work_id set not null;

-- 4. Functions, view, triggers.
drop table if exists public.location_reviews; -- from 008, if applied
drop function if exists public.merge_locations(int, int[]);
drop function if exists public.search_catalogue(text);
drop function if exists public.nearby_locations(double precision, double precision, double precision, text, int);
drop view if exists public.catalogue_entries;
drop trigger if exists locations_geog on public.locations;
drop trigger if exists locations_status on public.locations;
drop trigger if exists locations_work on public.locations;
drop function if exists public.locations_sync_geog();
drop function if exists public.locations_sync_status();
drop function if exists public.locations_ensure_work();

-- 5. Tables, indexes, columns.
drop table if exists public.location_works;
drop index if exists public.locations_geog_idx;
drop index if exists public.locations_verification_idx;
drop index if exists public.works_title_trgm;
drop index if exists public.locations_city_trgm;
drop index if exists public.locations_country_trgm;
alter table public.locations
  drop column if exists recheck,             -- from 008, if applied
  drop column if exists verification_method, -- from 008, if applied
  drop column if exists merged_into,
  drop column if exists geog,
  drop column if exists verified_at,
  drop column if exists is_filming_location,
  drop column if exists public_access,
  drop column if exists location_confidence,
  drop column if exists verification_status,
  drop column if exists country_code,
  drop column if exists country;

commit;

-- The postgis and pg_trgm extensions stay installed; they are harmless. To remove them too:
-- drop extension if exists pg_trgm; drop extension if exists postgis;

notify pgrst, 'reload schema';
