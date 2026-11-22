-- Rollback for 008_verification.sql: back to the 007 schema. Rows in needs_review become draft.
set search_path = public, extensions;
begin;
update public.locations set verification_status = 'draft' where verification_status = 'needs_review';
alter table public.locations drop constraint if exists locations_verification_status_check;
alter table public.locations add constraint locations_verification_status_check
  check (verification_status in ('draft', 'verified', 'published', 'rejected'));
drop table if exists public.location_reviews;
drop function if exists public.nearby_locations(double precision, double precision, double precision, text, int);
drop view if exists public.catalogue_entries;
alter table public.locations drop column if exists recheck, drop column if exists verification_method;
commit;
-- Then re-run the view and nearby_locations sections of 007_catalogue.sql (lines 122–170) to restore them.
notify pgrst, 'reload schema';
