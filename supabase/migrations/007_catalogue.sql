-- Catalogue v2, additive only. Every existing table, column, view and query keeps working.
--  * One physical place can belong to several titles (location_works).
--  * Verification status, country, confidence, public access, "filmed here" vs story setting.
--  * PostGIS point + nearby_locations(), trigram search + search_catalogue().
--  * merge_locations() for duplicates found by `npm run duplicates` (nothing is merged here).
-- Safe to run more than once. Run after 006.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
-- Supabase puts extensions in their own schema; this session (and every function below) looks there too.
set search_path = public, extensions;

-- Locations: new columns ---------------------------------------------------

alter table public.locations
  add column if not exists country             text,
  add column if not exists country_code        text check (country_code ~ '^[A-Z]{2}$'),
  add column if not exists verification_status text not null default 'draft'
    check (verification_status in ('draft', 'verified', 'published', 'rejected')),
  add column if not exists location_confidence text
    check (location_confidence in ('exact', 'building', 'street', 'area')),
  add column if not exists public_access       text not null default 'unknown'
    check (public_access in ('public', 'exterior_only', 'restricted', 'unknown')),
  -- false = the story is set here but it wasn't filmed here: never shown as "filmed here"
  add column if not exists is_filming_location boolean not null default true,
  add column if not exists verified_at         timestamptz,
  -- set when this row was merged into another one; kept so old links can be remapped
  add column if not exists merged_into         int references public.locations (id),
  add column if not exists geog                geography(Point, 4326);

-- Deprecated, kept for now: titles live in location_works, status follows verification_status.
alter table public.locations alter column work_id drop not null;

create index if not exists locations_geog_idx on public.locations using gist (geog);
create index if not exists locations_verification_idx on public.locations (verification_status);

-- geog always follows lat/lng.
create or replace function public.locations_sync_geog() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.geog := case when new.lat is null or new.lng is null then null
                   else st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography end;
  return new;
end $$;
drop trigger if exists locations_geog on public.locations;
create trigger locations_geog before insert or update of lat, lng on public.locations
for each row execute function public.locations_sync_geog();

-- During the transition the old `status` and the new `verification_status` stay in step,
-- so the admin "Live" button, the seed import and the old RLS policy keep working.
create or replace function public.locations_sync_status() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'live' then new.verification_status := 'published';
    elsif new.verification_status = 'published' then new.status := 'live';
    end if;
  elsif new.verification_status is distinct from old.verification_status then
    new.status := case when new.verification_status = 'published' then 'live' else 'unverified' end;
  elsif new.status is distinct from old.status then
    new.verification_status := case
      when new.status = 'live' then 'published'
      when old.verification_status = 'published' then 'verified'
      else old.verification_status end;
  end if;
  if new.verification_status = 'published' and new.verified_at is null then new.verified_at := now(); end if;
  return new;
end $$;
drop trigger if exists locations_status on public.locations;
create trigger locations_status before insert or update on public.locations
for each row execute function public.locations_sync_status();

-- One place, many titles -----------------------------------------------------

create table if not exists public.location_works (
  location_id  int  not null references public.locations (id) on delete cascade,
  work_id      text not null references public.works (id) on delete cascade,
  scene_note   text,
  depicts      text, -- what the place stands for in the story, e.g. "Winden police station"
  evidence_url text check (evidence_url ~ '^https?://'),
  primary key (location_id, work_id)
);
create index if not exists location_works_work_idx on public.location_works (work_id);

-- Old writers (seed import, research) still set locations.work_id: give them a location_works row.
create or replace function public.locations_ensure_work() returns trigger
language plpgsql as $$
begin
  if new.work_id is not null then
    insert into public.location_works (location_id, work_id, scene_note)
    values (new.id, new.work_id, new.scene_note)
    on conflict (location_id, work_id) do update set scene_note = excluded.scene_note;
  end if;
  return new;
end $$;
drop trigger if exists locations_work on public.locations;
create trigger locations_work after insert or update of work_id, scene_note on public.locations
for each row execute function public.locations_ensure_work();

-- Backfill -----------------------------------------------------------------------

insert into public.location_works (location_id, work_id, scene_note)
select id, work_id, scene_note from public.locations where work_id is not null
on conflict (location_id, work_id) do nothing;

update public.locations set verification_status = 'published', verified_at = coalesce(verified_at, now())
where status = 'live' and verification_status <> 'published';

-- Every place so far is in Germany (the geocoder only searches Germany).
update public.locations set country = 'Germany', country_code = 'DE' where country_code is null;

update public.locations set lat = lat where geog is null and lat is not null; -- fires the geog trigger

-- What the app reads: one row per published filming place and title -----------------

create or replace view public.catalogue_entries
with (security_invoker = true) as
select l.id, lw.work_id, l.name,
       coalesce(lw.scene_note, l.scene_note) as scene_note,
       lw.depicts, l.address, l.city, l.region, l.country, l.country_code, l.lat, l.lng,
       l.coord_quality, l.location_confidence, l.public_access, l.visit_note, l.source_name,
       coalesce(lw.evidence_url, l.source_url) as source_url
from public.locations l
join public.location_works lw on lw.location_id = l.id
where l.verification_status = 'published' and l.is_filming_location
  and l.merged_into is null and l.lat is not null and l.lng is not null;

-- Nearby: published filming places around a point, closest first. radius null = anywhere.
create or replace function public.nearby_locations(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision default null, p_work_id text default null, p_max_results int default 200
) returns table (
  id int, name text, address text, city text, region text, country text, country_code text,
  lat double precision, lng double precision, coord_quality text, location_confidence text,
  public_access text, visit_note text, source_name text, source_url text,
  distance_km double precision, works jsonb
)
language sql stable security invoker set search_path = public, extensions as $$
  with here as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select l.id, l.name, l.address, l.city, l.region, l.country, l.country_code, l.lat, l.lng,
         l.coord_quality, l.location_confidence, l.public_access, l.visit_note, l.source_name, l.source_url,
         st_distance(l.geog, here.g, false) / 1000 as distance_km, -- sphere, like the app's haversine
         (select jsonb_agg(jsonb_build_object(
                   'id', w.id, 'title', w.title, 'type', w.type,
                   'scene_note', coalesce(lw.scene_note, l.scene_note), 'depicts', lw.depicts)
                 order by w.title)
            from public.location_works lw join public.works w on w.id = lw.work_id
           where lw.location_id = l.id) as works
  from public.locations l, here
  where l.verification_status = 'published' and l.is_filming_location and l.merged_into is null
    and l.geog is not null
    and (p_radius_km is null or st_dwithin(l.geog, here.g, p_radius_km * 1000, false))
    and (p_work_id is null or exists (
          select 1 from public.location_works lw where lw.location_id = l.id and lw.work_id = p_work_id))
    and exists (select 1 from public.location_works lw where lw.location_id = l.id)
  order by distance_km, l.id
  limit least(greatest(coalesce(p_max_results, 200), 1), 1000);
$$;

-- Search -----------------------------------------------------------------------------

create index if not exists works_title_trgm on public.works using gin (lower(title) gin_trgm_ops);
create index if not exists locations_city_trgm on public.locations using gin (lower(city) gin_trgm_ops);
create index if not exists locations_country_trgm on public.locations using gin (lower(country) gin_trgm_ops);

-- Works (by title or alias), cities and countries that have published filming places.
create or replace function public.search_catalogue(q text)
returns table (kind text, id text, label text, places int, score real)
language sql stable security invoker set search_path = public, extensions as $$
  with term as (select lower(trim(coalesce(q, ''))) as t),
  pub as (select * from public.catalogue_entries),
  hits as (
    select 'work'::text as kind, w.id, w.title as label, count(distinct p.id)::int as places,
           greatest(similarity(lower(w.title), t.t),
                    coalesce((select max(similarity(lower(a), t.t)) from unnest(w.aliases) a), 0)) as score
    from public.works w join pub p on p.work_id = w.id, term t
    where length(t.t) >= 2 and (lower(w.title) like '%' || t.t || '%' or lower(w.title) % t.t
       or exists (select 1 from unnest(w.aliases) a where lower(a) like '%' || t.t || '%' or lower(a) % t.t))
    group by w.id, w.title, w.aliases, t.t
    union all
    select 'city', p.city, p.city, count(distinct p.id)::int, similarity(lower(p.city), t.t)
    from pub p, term t
    where p.city is not null and length(t.t) >= 2 and (lower(p.city) like '%' || t.t || '%' or lower(p.city) % t.t)
    group by p.city, t.t
    union all
    select 'country', p.country_code, p.country, count(distinct p.id)::int, similarity(lower(p.country), t.t)
    from pub p, term t
    where p.country is not null and length(t.t) >= 2
      and (lower(p.country) like '%' || t.t || '%' or lower(p.country) % t.t or lower(p.country_code) = t.t)
    group by p.country_code, p.country, t.t
  )
  select kind, id, label, places, score from hits order by score desc, places desc, label limit 20;
$$;

-- Merging duplicates (service role only, called by scripts/find-duplicates.ts) ------------

-- Moves every title of p_drop onto p_keep, marks the dropped rows rejected (never deleted),
-- and remaps saved trips and passports so old links keep their stops and check-ins.
create or replace function public.merge_locations(p_keep int, p_drop int[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_keep = any(p_drop) then raise exception 'cannot merge a location into itself'; end if;
  insert into public.location_works (location_id, work_id, scene_note, depicts, evidence_url)
  select p_keep, work_id, scene_note, depicts, evidence_url from public.location_works where location_id = any(p_drop)
  on conflict (location_id, work_id) do nothing;
  update public.locations set merged_into = p_keep, verification_status = 'rejected' where id = any(p_drop);
  update public.passports
     set visited = (select array_agg(distinct case when v = any(p_drop) then p_keep else v end) from unnest(visited) v)
   where visited && p_drop;
  update public.trips t
     set plan = jsonb_set(t.plan, '{stops}', (
       select jsonb_agg(case when (s->>'location_id')::int = any(p_drop)
                             then jsonb_set(s, '{location_id}', to_jsonb(p_keep)) else s end order by n)
       from jsonb_array_elements(t.plan->'stops') with ordinality as e(s, n)))
   where exists (select 1 from jsonb_array_elements(t.plan->'stops') s where (s->>'location_id')::int = any(p_drop));
end $$;
revoke execute on function public.merge_locations(int, int[]) from public, anon, authenticated;
grant execute on function public.merge_locations(int, int[]) to service_role;

-- Row-level security: the public reads published places only -----------------------

alter table public.location_works enable row level security;

drop policy if exists "live locations are public" on public.locations;
drop policy if exists "published locations are public" on public.locations;
create policy "published locations are public" on public.locations
  for select using (verification_status = 'published');

drop policy if exists "titles of published locations are public" on public.location_works;
create policy "titles of published locations are public" on public.location_works
  for select using (exists (
    select 1 from public.locations l where l.id = location_id and l.verification_status = 'published'));

-- nearby_locations runs as the caller, so the API roles need PostGIS (Supabase grants this already).
grant usage on schema extensions to anon, authenticated, service_role;
grant select on public.location_works, public.catalogue_entries to anon, authenticated;
grant all on public.location_works to service_role;
grant execute on function public.nearby_locations(double precision, double precision, double precision, text, int)
  to anon, authenticated, service_role;
grant execute on function public.search_catalogue(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
