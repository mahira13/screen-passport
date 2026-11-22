-- The data pipeline: a job queue, a run log, the daily AI budget, a shared Nominatim throttle with
-- a geocode cache, and the on-demand title search state on requests. Run after 013.
-- Safe to run more than once. Everything here is server-only (service role); the public never
-- reads these tables directly.

set search_path = public, extensions;

-- Works found by the pipeline keep their Wikidata item, so a title is never added twice.
alter table public.works add column if not exists wikidata_id text check (wikidata_id ~ '^Q[0-9]+$');
create unique index if not exists works_wikidata_id_key on public.works (wikidata_id) where wikidata_id is not null;

-- On-demand search state for a requested title: queued → searching → found | nothing | failed.
alter table public.requests
  add column if not exists search_status text check (search_status in ('queued', 'searching', 'found', 'nothing', 'failed')),
  add column if not exists work_id text references public.works (id) on delete set null,
  add column if not exists found int not null default 0,
  add column if not exists message text check (char_length(message) <= 300),
  add column if not exists searched_at timestamptz;

-- Jobs ---------------------------------------------------------------------------------------

create table if not exists public.pipeline_jobs (
  id           bigserial primary key,
  kind         text not null check (kind in ('discover', 'title', 'research', 'verify', 'images', 'outline', 'dedupe', 'recheck')),
  payload      jsonb not null default '{}',
  dedupe_key   text,                         -- same key, not finished: not queued twice
  request_id   int references public.requests (id) on delete set null,
  status       text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'waiting_budget')),
  priority     int not null default 100,     -- lower runs first; user requests use 10
  attempts     int not null default 0,
  run_after    timestamptz not null default now(),
  locked_until timestamptz,
  last_error   text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists pipeline_jobs_ready on public.pipeline_jobs (priority, id) where status in ('queued', 'running', 'waiting_budget');
create index if not exists pipeline_jobs_request on public.pipeline_jobs (request_id) where request_id is not null;
create unique index if not exists pipeline_jobs_dedupe on public.pipeline_jobs (dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running', 'waiting_budget');

-- Claims up to p_limit ready jobs (queued, budget-waiting past run_after, or running with an
-- expired lease) and leases them. skip locked: parallel workers never get the same job.
create or replace function public.claim_jobs(p_limit int, p_lease_seconds int, p_request_id int default null, p_kinds text[] default null)
returns setof public.pipeline_jobs language plpgsql as $$
begin
  return query
  update public.pipeline_jobs j
     set status = 'running', attempts = j.attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
   where j.id in (
     select id from public.pipeline_jobs
      where run_after <= now()
        and (status in ('queued', 'waiting_budget') or (status = 'running' and locked_until < now()))
        and (p_request_id is null or request_id = p_request_id)
        and (p_kinds is null or kind = any(p_kinds))
      order by priority, id
      limit p_limit
      for update skip locked)
  returning j.*;
end $$;

-- Runs -----------------------------------------------------------------------------------------

create table if not exists public.pipeline_runs (
  id            bigserial primary key,
  trigger       text not null check (trigger in ('cron', 'request', 'manual')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  jobs_done     int not null default 0,
  jobs_failed   int not null default 0,
  candidates_in int not null default 0,      -- draft places inserted
  published     int not null default 0,
  needs_review  int not null default 0,
  rejected      int not null default 0,
  merged        int not null default 0,
  ai_calls      int not null default 0,
  cost_usd      numeric(10, 4) not null default 0, -- estimate from token usage and list prices
  budget_hit    boolean not null default false,
  notes         jsonb not null default '[]'
);

-- Daily AI budget ------------------------------------------------------------------------------

create table if not exists public.ai_usage (
  day      date primary key,
  calls    int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  reserved numeric(10, 4) not null default 0   -- calls in flight
);

-- Reserves p_estimate for one call if spent + in flight + estimate stays within p_budget (UTC day).
create or replace function public.ai_reserve(p_estimate numeric, p_budget numeric) returns boolean
language plpgsql as $$
declare d date := (now() at time zone 'utc')::date;
begin
  insert into public.ai_usage (day) values (d) on conflict do nothing;
  perform 1 from public.ai_usage where day = d for update;
  if (select cost_usd + reserved + p_estimate from public.ai_usage where day = d) > p_budget then return false; end if;
  update public.ai_usage set reserved = reserved + p_estimate where day = d;
  return true;
end $$;

-- Replaces the reservation with what the call really cost.
create or replace function public.ai_settle(p_estimate numeric, p_actual numeric) returns void
language sql as $$
  update public.ai_usage
     set reserved = greatest(0, reserved - p_estimate), cost_usd = cost_usd + p_actual, calls = calls + 1
   where day = (now() at time zone 'utc')::date;
$$;

-- Shared throttle (Nominatim: one request per second for every worker together) ----------------

create table if not exists public.throttle (
  name    text primary key,
  next_at timestamptz not null default now()
);

-- Books the next free slot for p_name and returns how many ms to wait for it. The advisory lock
-- makes bookings sequential, so slots are always p_gap_ms apart however many workers run.
create or replace function public.throttle_slot(p_name text, p_gap_ms int) returns int
language plpgsql as $$
declare slot timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('throttle:' || p_name));
  insert into public.throttle (name, next_at) values (p_name, now()) on conflict do nothing;
  select greatest(next_at, clock_timestamp()) into slot from public.throttle where name = p_name;
  update public.throttle set next_at = slot + make_interval(secs => p_gap_ms / 1000.0) where name = p_name;
  return greatest(0, ceil(extract(epoch from (slot - clock_timestamp())) * 1000))::int;
end $$;

create table if not exists public.geocode_cache (
  query      text primary key,                -- normalised query + options
  hit        jsonb,                           -- null: Nominatim found nothing
  fetched_at timestamptz not null default now()
);

-- Server only --------------------------------------------------------------------------------

alter table public.pipeline_jobs enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.throttle enable row level security;
alter table public.geocode_cache enable row level security;

revoke all on public.pipeline_jobs, public.pipeline_runs, public.ai_usage, public.throttle, public.geocode_cache from anon, authenticated;
grant all on public.pipeline_jobs, public.pipeline_runs, public.ai_usage, public.throttle, public.geocode_cache to service_role;
grant all on sequence public.pipeline_jobs_id_seq, public.pipeline_runs_id_seq to service_role;

revoke execute on function public.claim_jobs(int, int, int, text[]) from public, anon, authenticated;
revoke execute on function public.ai_reserve(numeric, numeric) from public, anon, authenticated;
revoke execute on function public.ai_settle(numeric, numeric) from public, anon, authenticated;
revoke execute on function public.throttle_slot(text, int) from public, anon, authenticated;
grant execute on function public.claim_jobs(int, int, int, text[]) to service_role;
grant execute on function public.ai_reserve(numeric, numeric) to service_role;
grant execute on function public.ai_settle(numeric, numeric) to service_role;
grant execute on function public.throttle_slot(text, int) to service_role;

notify pgrst, 'reload schema';
