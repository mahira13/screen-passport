-- Other names for a place, and a site outline for check-in at large landmarks. Run after 012.
-- Safe to run more than once.
--  * aliases: other names the place is known by (e.g. its German name), used when matching sources
--    and geocoder results. Internal; not in the public view.
--  * check_in_area: the site's OSM outline as GeoJSON (Polygon or MultiPolygon, lng/lat), for places
--    like cemeteries and parks. When set, "I'm here" accepts any point inside it (instead of the
--    bounding box). Filled by scripts/fetch-outline.ts.

set search_path = public, extensions;

alter table public.locations
  add column if not exists aliases text[] not null default '{}',
  add column if not exists check_in_area jsonb check (
    check_in_area is null or (
      check_in_area->>'type' in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(check_in_area->'coordinates') = 'array'
      and octet_length(check_in_area::text) <= 50000));

-- Aliases and visit notes are data: they come from data/seed/locations.csv (aliases column) and
-- the pipeline (Wikidata labels), never from a migration.

-- Same columns and order as 009; the outline is appended (a view can only gain columns at the end).
create or replace view public.catalogue_entries
with (security_invoker = true) as
select l.id, lw.work_id, l.name,
       coalesce(lw.scene_note, l.scene_note) as scene_note,
       lw.depicts, l.address, l.city, l.region, l.country, l.country_code, l.lat, l.lng,
       l.coord_quality, l.location_confidence, l.public_access, l.visit_note,
       coalesce(lw.evidence_name, l.source_name) as source_name,
       coalesce(lw.evidence_url, l.source_url) as source_url,
       l.verification_method, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east,
       case when l.image_status in ('auto', 'approved') then l.image_thumb_url end as image_thumb_url,
       case when l.image_status in ('auto', 'approved') then l.image_author end as image_author,
       case when l.image_status in ('auto', 'approved') then l.image_license end as image_license,
       case when l.image_status in ('auto', 'approved') then l.image_license_url end as image_license_url,
       case when l.image_status in ('auto', 'approved') then l.image_source_page end as image_source_page,
       l.check_in_area
from public.locations l
join public.location_works lw on lw.location_id = l.id
where l.verification_status = 'published' and l.is_filming_location
  and l.merged_into is null and l.lat is not null and l.lng is not null;

notify pgrst, 'reload schema';
