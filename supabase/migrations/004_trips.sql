-- Trips and joins. Safe to run twice.
-- No public RLS policies: only server routes with the service role key read or write these tables.

create table if not exists public.trips (
  id             text primary key check (char_length(id) >= 12),
  title          text not null check (char_length(title) <= 120),
  intro          text check (char_length(intro) <= 1000),
  work_ids       text[] not null,
  start_label    text not null check (char_length(start_label) <= 80),
  start_lat      double precision not null check (start_lat between -90 and 90),
  start_lng      double precision not null check (start_lng between -180 and 180),
  mode           text not null check (mode in ('walk', 'transit', 'car')),
  length         text not null check (length in ('half', 'full')),
  starts_at      timestamptz not null,
  meeting_point  text not null check (char_length(meeting_point) <= 200),
  organiser_name text not null check (char_length(organiser_name) between 1 and 30),
  plan           jsonb not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.trip_joins (
  id         serial primary key,
  trip_id    text not null references public.trips(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 30),
  created_at timestamptz not null default now()
);
create index if not exists trip_joins_trip_id on public.trip_joins (trip_id);

alter table public.trips      enable row level security;
alter table public.trip_joins enable row level security;
revoke all on public.trips, public.trip_joins from anon, authenticated;
grant all on public.trips, public.trip_joins to service_role;
grant all on sequence public.trip_joins_id_seq to service_role;

-- Join with a cap of 50 per trip. Locks the trip row so two joins can't both take the last place.
-- Returns 'ok', 'full' or 'not_found'.
create or replace function public.join_trip(p_trip_id text, p_first_name text) returns text
language plpgsql as $$
begin
  perform 1 from public.trips where id = p_trip_id for update;
  if not found then return 'not_found'; end if;
  if (select count(*) from public.trip_joins where trip_id = p_trip_id) >= 50 then return 'full'; end if;
  insert into public.trip_joins (trip_id, first_name) values (p_trip_id, p_first_name);
  return 'ok';
end;
$$;
revoke execute on function public.join_trip(text, text) from public, anon, authenticated;
grant execute on function public.join_trip(text, text) to service_role;

-- A title we don't have yet: add it or count it once more.
create or replace function public.add_request(p_raw text, p_normalised text) returns void
language sql as $$
  insert into public.requests (raw_title, normalised_title) values (p_raw, p_normalised)
  on conflict (normalised_title) do update set count = public.requests.count + 1;
$$;
revoke execute on function public.add_request(text, text) from public, anon, authenticated;
grant execute on function public.add_request(text, text) to service_role;

-- New analytics events.
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'map_viewed', 'title_watched', 'passport_created', 'share_clicked',
  'checkin_success', 'postcard_made', 'layla_clicked', 'directions_clicked',
  'request_created', 'screenshot_read', 'trip_created', 'trip_joined', 'trip_shared'
));

notify pgrst, 'reload schema';
