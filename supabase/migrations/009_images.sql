-- Location photos from Wikimedia Commons (product rule 6: Commons only, with credit). Run after 008.
-- Safe to run more than once. image_status: 'auto' (Claude says it matches), 'approved'/'rejected'
-- (a person decided), null (found but waiting for review, or no image yet).
-- The public view shows a photo only when it is 'auto' or 'approved'.

set search_path = public, extensions;

alter table public.locations
  add column if not exists image_url          text check (image_url ~ '^https://upload\.wikimedia\.org/'),
  add column if not exists image_thumb_url    text check (image_thumb_url ~ '^https://upload\.wikimedia\.org/'),
  add column if not exists image_author       text check (char_length(image_author) <= 200),
  add column if not exists image_license      text check (char_length(image_license) <= 60),
  add column if not exists image_license_url  text check (image_license_url ~ '^https?://'),
  add column if not exists image_source_page  text check (image_source_page ~ '^https://commons\.wikimedia\.org/'),
  add column if not exists image_status       text check (image_status in ('auto', 'approved', 'rejected')),
  -- Claude's reason for the current photo (internal, never in the public view).
  add column if not exists image_check_reason text check (char_length(image_check_reason) <= 300),
  -- Helpers: the place's Wikidata item (for its P18 image), and Commons file names
  -- ("File:Name.jpg") a person turned down, which "Find another" never offers again.
  add column if not exists wikidata_id        text check (wikidata_id ~ '^Q[0-9]+$'),
  add column if not exists image_skip         text[] not null default '{}';

-- A shown photo always carries its full credit.
alter table public.locations drop constraint if exists locations_image_credit_check;
alter table public.locations add constraint locations_image_credit_check check (
  coalesce(image_status, '') not in ('auto', 'approved')
  or (image_thumb_url is not null and image_author is not null and image_license is not null
      and image_source_page is not null));

-- Only source URLs that are exactly a Wikidata item page; store just the Q-id.
update public.locations
set wikidata_id = substring(source_url from '/wiki/(Q[0-9]+)$')
where wikidata_id is null
  and source_url ~ '^https?://(www\.|m\.)?wikidata\.org/wiki/Q[0-9]+$';

-- Same columns and order as 008; the photo columns are appended (a view can only gain columns at the end).
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
       case when l.image_status in ('auto', 'approved') then l.image_source_page end as image_source_page
from public.locations l
join public.location_works lw on lw.location_id = l.id
where l.verification_status = 'published' and l.is_filming_location
  and l.merged_into is null and l.lat is not null and l.lng is not null;

notify pgrst, 'reload schema';
