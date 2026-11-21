-- Screen Passport: initial schema and row-level security.
-- Server routes use the service role key (bypasses RLS). The rules below
-- are what the public anon key can do.

create table public.works (
  id      text primary key,
  title   text not null,
  type    text not null check (type in ('series', 'film')),
  aliases text[] not null default '{}',
  year    int
);

create table public.locations (
  id            serial primary key,
  work_id       text not null references public.works (id) on delete cascade,
  name          text not null,
  scene_note    text,
  address       text,
  city          text,
  region        text,
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),
  -- null until coordinates exist (then `npm run geocode` sets 'geocoded')
  coord_quality text check (coord_quality in ('source', 'approx', 'geocoded', 'verified')),
  visit_note    text,
  source_name   text,
  source_url    text not null check (source_url ~ '^https?://'),
  status        text not null default 'live' check (status in ('live', 'unverified')),
  check ((lat is null) = (lng is null))
);
create index locations_work_id_idx on public.locations (work_id);
create index locations_status_idx on public.locations (status);

create table public.collections (
  id          text primary key,
  name        text not null,
  city        text,
  work_ids    text[] not null default '{}',
  description text
);

create table public.passports (
  id           text primary key check (char_length(id) >= 12),
  display_name text check (char_length(display_name) <= 40),
  start_city   text,
  lat          double precision,
  lng          double precision,
  watched      text[] not null default '{}',
  visited      int[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.requests (
  id               serial primary key,
  raw_title        text not null check (char_length(raw_title) <= 200),
  normalised_title text not null unique,
  count            int not null default 1,
  status           text not null default 'open'
                   check (status in ('open', 'researched', 'approved', 'rejected')),
  created_at       timestamptz not null default now()
);

create table public.events (
  id         serial primary key,
  name       text not null check (name in (
    'map_viewed', 'title_watched', 'passport_created', 'share_clicked',
    'checkin_success', 'postcard_made', 'layla_clicked', 'directions_clicked',
    'request_created', 'screenshot_read'
  )),
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger passports_touch before update on public.passports
for each row execute function public.touch_updated_at();

-- What the nearby query reads: live locations that have coordinates.
-- Rows without lat/lng stay hidden until geocoded.
create view public.mappable_locations
with (security_invoker = true) as
select * from public.locations
where status = 'live' and lat is not null and lng is not null;

-- Row-level security ------------------------------------------------------

alter table public.works       enable row level security;
alter table public.locations   enable row level security;
alter table public.collections enable row level security;
alter table public.passports   enable row level security;
alter table public.requests    enable row level security;
alter table public.events      enable row level security;

create policy "works are public" on public.works
  for select using (true);
create policy "live locations are public" on public.locations
  for select using (status = 'live');
create policy "collections are public" on public.collections
  for select using (true);

-- Anyone can create a passport. There is no select policy, so nobody can
-- list passports; reading one by its exact id goes through get_passport().
create policy "anyone can create a passport" on public.passports
  for insert with check (true);

create policy "anyone can add a request" on public.requests
  for insert with check (status = 'open' and count = 1);

create policy "anyone can log an event" on public.events
  for insert with check (true);

create function public.get_passport(p_id text)
returns setof public.passports
language sql stable security definer set search_path = public as $$
  select * from public.passports where id = p_id;
$$;
revoke execute on function public.get_passport(text) from public;
grant execute on function public.get_passport(text) to anon, authenticated, service_role;

-- Used by scripts/import-seed.ts after inserting rows with explicit ids.
create function public.sync_locations_id_seq() returns void
language sql security definer set search_path = public as $$
  select setval(
    pg_get_serial_sequence('public.locations', 'id'),
    coalesce((select max(id) from public.locations), 0) + 1,
    false
  );
$$;
revoke execute on function public.sync_locations_id_seq() from public, anon, authenticated;
grant execute on function public.sync_locations_id_seq() to service_role;
