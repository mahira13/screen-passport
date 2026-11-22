-- Verification v2, additive. Run after 007. Safe to run more than once.
--  * verification_status gains 'needs_review' (the pipeline couldn't confirm; a person decides).
--  * verification_method: who confirmed a published place ('ai' or 'team'), shown as a badge.
--  * recheck: an admin marks a place to be verified again.
--  * coord_quality gains 'geocoded_poi' (a geocoder match on a named landmark, name and city checked;
--    allows check-in) and a bounding box for large sites (check-in anywhere inside).
--  * location_reviews: every verification run with its reasons and evidence quote. Internal only:
--    RLS on, no policies, so only server routes with the service role key can read it.

set search_path = public, extensions;

-- New status value ----------------------------------------------------------------
alter table public.locations drop constraint if exists locations_verification_status_check;
alter table public.locations add constraint locations_verification_status_check
  check (verification_status in ('draft', 'needs_review', 'verified', 'published', 'rejected'));

alter table public.locations drop constraint if exists locations_coord_quality_check;
alter table public.locations add constraint locations_coord_quality_check
  check (coord_quality in ('source', 'approx', 'geocoded', 'geocoded_poi', 'verified'));

alter table public.locations
  add column if not exists verification_method text check (verification_method in ('ai', 'team')),
  add column if not exists recheck boolean not null default false,
  add column if not exists bbox_south double precision check (bbox_south between -90 and 90),
  add column if not exists bbox_west  double precision check (bbox_west between -180 and 180),
  add column if not exists bbox_north double precision check (bbox_north between -90 and 90),
  add column if not exists bbox_east  double precision check (bbox_east between -180 and 180);

-- Drafts still resting on a rental marketplace or a blog wait for re-sourcing (e.g. visit-goerlitz.com).
update public.locations set verification_status = 'needs_review'
where verification_status = 'draft' and source_url ~* '://([a-z0-9-]+\.)*(giggster\.com|foodieexplorers\.co\.uk)/';

-- Everything published so far was set live by a person in /admin/locations.
update public.locations set verification_method = 'team'
where verification_status = 'published' and verification_method is null;

-- Review log (internal) ---------------------------------------------------------------
create table if not exists public.location_reviews (
  id             bigserial primary key,
  location_id    int  not null references public.locations (id) on delete cascade,
  work_id        text references public.works (id) on delete set null, -- the claim that was checked
  method         text not null check (method in ('ai', 'team')),
  decision       text not null check (decision in ('published', 'needs_review', 'rejected')),
  reasons        text[] not null default '{}',     -- e.g. {"source unreachable", "domain not trusted"}
  evidence_url   text,
  evidence_quote text check (char_length(evidence_quote) <= 300), -- copied from the page, checked in code
  ai_result      jsonb,                            -- the model's JSON answer as received
  model          text,
  geocode        jsonb,                            -- what Nominatim returned (type, class, display name)
  created_at     timestamptz not null default now()
);
create index if not exists location_reviews_location_idx on public.location_reviews (location_id, created_at desc);
alter table public.location_reviews enable row level security;
revoke all on public.location_reviews from anon, authenticated;
grant all on public.location_reviews to service_role;
grant usage on sequence public.location_reviews_id_seq to service_role;

-- The app's view and nearby_locations carry the badge ---------------------------------
-- (Views can only gain columns at the end; the function's return type changes, so drop first.)
create or replace view public.catalogue_entries
with (security_invoker = true) as
select l.id, lw.work_id, l.name,
       coalesce(lw.scene_note, l.scene_note) as scene_note,
       lw.depicts, l.address, l.city, l.region, l.country, l.country_code, l.lat, l.lng,
       l.coord_quality, l.location_confidence, l.public_access, l.visit_note,
       coalesce(lw.evidence_name, l.source_name) as source_name,
       coalesce(lw.evidence_url, l.source_url) as source_url,
       l.verification_method, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east
from public.locations l
join public.location_works lw on lw.location_id = l.id
where l.verification_status = 'published' and l.is_filming_location
  and l.merged_into is null and l.lat is not null and l.lng is not null;

drop function if exists public.nearby_locations(double precision, double precision, double precision, text, int);
create function public.nearby_locations(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision default null, p_work_id text default null, p_max_results int default 200
) returns table (
  id int, name text, address text, city text, region text, country text, country_code text,
  lat double precision, lng double precision, coord_quality text, location_confidence text,
  public_access text, visit_note text, source_name text, source_url text, verification_method text,
  bbox_south double precision, bbox_west double precision, bbox_north double precision, bbox_east double precision,
  distance_km double precision, works jsonb
)
language sql stable security invoker set search_path = public, extensions as $$
  with here as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select l.id, l.name, l.address, l.city, l.region, l.country, l.country_code, l.lat, l.lng,
         l.coord_quality, l.location_confidence, l.public_access, l.visit_note, l.source_name, l.source_url,
         l.verification_method, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east,
         st_distance(l.geog, here.g, false) / 1000 as distance_km,
         (select jsonb_agg(jsonb_build_object(
                   'id', w.id, 'title', w.title, 'type', w.type,
                   'scene_note', coalesce(lw.scene_note, l.scene_note), 'depicts', lw.depicts,
                   'evidence_url', coalesce(lw.evidence_url, l.source_url),
                   'evidence_name', coalesce(lw.evidence_name, l.source_name))
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
grant execute on function public.nearby_locations(double precision, double precision, double precision, text, int)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
