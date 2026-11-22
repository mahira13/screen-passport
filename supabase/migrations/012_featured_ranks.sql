-- Featured collections on Discover (featured_rank from 010). Run after 010.
-- Pins are data: set and reorder them in /admin/locations ("Featured collections"). This migration
-- used to set three pins by collection id; it now changes nothing, so re-running it can never undo
-- a choice made in the admin.
select 1;
