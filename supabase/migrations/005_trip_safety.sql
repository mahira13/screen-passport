-- Trip time zones, organiser delete key, reports, rate limits. Safe to run twice.

alter table public.trips add column if not exists timezone text not null default 'Europe/Berlin'
  check (char_length(timezone) <= 64);
alter table public.trips add column if not exists delete_key_hash text;
alter table public.trips add column if not exists hidden_at timestamptz;

-- One report per trip per hashed IP. Three reports hide the trip.
create table if not exists public.trip_reports (
  trip_id    text not null references public.trips(id) on delete cascade,
  ip_hash    text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (trip_id, ip_hash)
);

-- Rate limit counters. key_hash is a salted sha256 of the IP (never the raw IP), or 'global'.
create table if not exists public.rate_events (
  id         bigserial primary key,
  bucket     text not null,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup on public.rate_events (bucket, key_hash, created_at);
create index if not exists rate_events_created on public.rate_events (created_at);

alter table public.trip_reports enable row level security;
alter table public.rate_events  enable row level security;
revoke all on public.trip_reports, public.rate_events from anon, authenticated;
grant all on public.trip_reports, public.rate_events to service_role;
grant all on sequence public.rate_events_id_seq to service_role;

-- Takes one slot if fewer than p_limit were taken in the window. Atomic per bucket+key.
create or replace function public.take_rate(p_bucket text, p_key text, p_limit int, p_window interval)
returns boolean
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key));
  delete from public.rate_events where created_at < now() - interval '2 days';
  if (select count(*) from public.rate_events
      where bucket = p_bucket and key_hash = p_key and created_at > now() - p_window) >= p_limit then
    return false;
  end if;
  insert into public.rate_events (bucket, key_hash) values (p_bucket, p_key);
  return true;
end;
$$;
revoke execute on function public.take_rate(text, text, int, interval) from public, anon, authenticated;
grant execute on function public.take_rate(text, text, int, interval) to service_role;

-- Returns 'ok' or 'not_found'. Hides the trip at 3 distinct reports.
create or replace function public.report_trip(p_trip_id text, p_ip_hash text) returns text
language plpgsql as $$
begin
  perform 1 from public.trips where id = p_trip_id and hidden_at is null for update;
  if not found then return 'not_found'; end if;
  insert into public.trip_reports (trip_id, ip_hash) values (p_trip_id, p_ip_hash) on conflict do nothing;
  if (select count(*) from public.trip_reports where trip_id = p_trip_id) >= 3 then
    update public.trips set hidden_at = now() where id = p_trip_id;
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.report_trip(text, text) from public, anon, authenticated;
grant execute on function public.report_trip(text, text) to service_role;

-- Hidden trips take no new joins.
create or replace function public.join_trip(p_trip_id text, p_first_name text) returns text
language plpgsql as $$
begin
  perform 1 from public.trips where id = p_trip_id and hidden_at is null for update;
  if not found then return 'not_found'; end if;
  if (select count(*) from public.trip_joins where trip_id = p_trip_id) >= 50 then return 'full'; end if;
  insert into public.trip_joins (trip_id, first_name) values (p_trip_id, p_first_name);
  return 'ok';
end;
$$;

notify pgrst, 'reload schema';
