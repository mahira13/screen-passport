-- Launch hardening. Run after 015. Safe to run more than once.
--  * Every write goes through a server route with the service role key, so the public API roles
--    (anon, authenticated) lose all direct writes. They keep reading the public catalogue:
--    published places only (RLS), works, collections and get_passport() by exact id.
--  * Two analytics events: search and page_viewed.
--  * Search indexes that match how search_catalogue() actually filters (search_norm, not lower).

set search_path = public, extensions;

-- Public roles: read-only --------------------------------------------------------------
drop policy if exists "anyone can create a passport" on public.passports;
drop policy if exists "anyone can add a request" on public.requests;
drop policy if exists "anyone can log an event" on public.events;

-- Supabase's default privileges grant ALL on new tables and views to the API roles; RLS already
-- blocks writes, this removes them at the grant level too.
revoke all on public.passports, public.requests, public.events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.works, public.locations, public.collections, public.location_works,
     public.catalogue_entries, public.mappable_locations
  from anon, authenticated;
revoke all on sequence public.requests_id_seq, public.events_id_seq from anon, authenticated;
do $$ begin
  if to_regclass('public.locations_id_seq') is not null then
    revoke all on sequence public.locations_id_seq from anon, authenticated;
  end if;
end $$;

-- Analytics -----------------------------------------------------------------------------
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'map_viewed', 'title_watched', 'passport_created', 'share_clicked', 'checkin_success',
  'postcard_made', 'layla_clicked', 'directions_clicked', 'request_created', 'screenshot_read',
  'trip_created', 'trip_joined', 'trip_shared', 'invite_shared', 'challenge_created', 'challenge_joined',
  'search', 'page_viewed'
));
create index if not exists events_name_created on public.events (name, created_at);

-- Search indexes --------------------------------------------------------------------------
-- search_catalogue() compares search_norm(city/country); the 007 indexes on lower() never match.
drop index if exists public.locations_city_trgm;
drop index if exists public.locations_country_trgm;
create index if not exists locations_city_norm_trgm
  on public.locations using gin (public.search_norm(city) extensions.gin_trgm_ops);
create index if not exists locations_country_norm_trgm
  on public.locations using gin (public.search_norm(country) extensions.gin_trgm_ops);

-- What every public read filters on.
create index if not exists locations_published_idx on public.locations (id)
  where verification_status = 'published' and is_filming_location and merged_into is null;

notify pgrst, 'reload schema';
