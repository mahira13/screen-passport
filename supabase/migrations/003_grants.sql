-- Newer Supabase projects don't grant table access to the API roles
-- automatically. These grants match the RLS rules in 001: RLS still decides
-- which rows each role can touch. Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

-- Server routes and scripts (service role bypasses RLS but still needs grants)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Public reads
grant select on public.works, public.locations, public.collections, public.mappable_locations
  to anon, authenticated;

-- Public inserts (RLS limits what can be inserted; no select, update or delete)
grant insert on public.passports, public.requests, public.events to anon, authenticated;
grant usage on sequence public.requests_id_seq, public.events_id_seq to anon, authenticated;
