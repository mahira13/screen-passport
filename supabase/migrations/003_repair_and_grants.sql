-- Brings a database where 001 stopped part-way up to date, then grants the
-- API roles access (newer Supabase projects don't grant it automatically).
-- Every statement is safe to run more than once. Run after 002.

-- Columns and defaults from 001
alter table public.locations add column if not exists geocode_query text;
alter table public.locations alter column status set default 'unverified';

-- passports.updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists passports_touch on public.passports;
create trigger passports_touch before update on public.passports
for each row execute function public.touch_updated_at();

-- What the nearby query reads: live locations that have coordinates.
drop view if exists public.mappable_locations;
create view public.mappable_locations
with (security_invoker = true) as
select * from public.locations
where status = 'live' and lat is not null and lng is not null;

-- Row-level security
alter table public.works       enable row level security;
alter table public.locations   enable row level security;
alter table public.collections enable row level security;
alter table public.passports   enable row level security;
alter table public.requests    enable row level security;
alter table public.events      enable row level security;

drop policy if exists "works are public" on public.works;
create policy "works are public" on public.works for select using (true);
drop policy if exists "live locations are public" on public.locations;
create policy "live locations are public" on public.locations for select using (status = 'live');
drop policy if exists "collections are public" on public.collections;
create policy "collections are public" on public.collections for select using (true);
drop policy if exists "anyone can create a passport" on public.passports;
create policy "anyone can create a passport" on public.passports for insert with check (true);
drop policy if exists "anyone can add a request" on public.requests;
create policy "anyone can add a request" on public.requests for insert with check (status = 'open' and count = 1);
drop policy if exists "anyone can log an event" on public.events;
create policy "anyone can log an event" on public.events for insert with check (true);

-- Used by scripts/import-seed.ts after inserting rows with explicit ids.
create or replace function public.sync_locations_id_seq() returns void
language sql security definer set search_path = public as $$
  select setval(
    pg_get_serial_sequence('public.locations', 'id'),
    coalesce((select max(id) from public.locations), 0) + 1,
    false
  );
$$;
revoke execute on function public.sync_locations_id_seq() from public, anon, authenticated;
grant execute on function public.sync_locations_id_seq() to service_role;

-- Grants. RLS above still decides which rows each role can touch.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on public.works, public.locations, public.collections, public.mappable_locations
  to anon, authenticated;
grant insert on public.passports, public.requests, public.events to anon, authenticated;
grant usage on sequence public.requests_id_seq, public.events_id_seq to anon, authenticated;

-- Make the API see the new functions straight away.
notify pgrst, 'reload schema';
