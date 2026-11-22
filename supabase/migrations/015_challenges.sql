-- Friend challenges: a group races to check in at every place of one collection.
-- collection_id is the collection key ("curated:<id>", "title:<work id>", "city:<slug>"), resolved
-- from live data on read. Server routes only: no public access.
create table if not exists public.challenges (
  id text primary key,
  collection_id text not null check (char_length(collection_id) between 3 and 200),
  created_by_passport text not null references public.passports(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_participants (
  challenge_id text not null references public.challenges(id) on delete cascade,
  passport_id text not null references public.passports(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (challenge_id, passport_id)
);
create index if not exists challenge_participants_open on public.challenge_participants (passport_id) where finished_at is null;

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
revoke all on public.challenges, public.challenge_participants from anon, authenticated;
grant select, insert, update, delete on public.challenges, public.challenge_participants to service_role;

-- 'ok' | 'already' | 'full' | 'not_found'. Locks the challenge so two joins can't pass 50 together.
create or replace function public.join_challenge(p_challenge_id text, p_passport_id text, p_name text) returns text
language plpgsql as $$
begin
  perform 1 from public.challenges where id = p_challenge_id for update;
  if not found then return 'not_found'; end if;
  if exists (select 1 from public.challenge_participants where challenge_id = p_challenge_id and passport_id = p_passport_id) then
    update public.challenge_participants set display_name = p_name where challenge_id = p_challenge_id and passport_id = p_passport_id;
    return 'already';
  end if;
  if (select count(*) from public.challenge_participants where challenge_id = p_challenge_id) >= 50 then return 'full'; end if;
  insert into public.challenge_participants (challenge_id, passport_id, display_name) values (p_challenge_id, p_passport_id, p_name);
  return 'ok';
end;
$$;
revoke execute on function public.join_challenge(text, text, text) from public, anon, authenticated;
grant execute on function public.join_challenge(text, text, text) to service_role;

-- Analytics: two new event names.
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'map_viewed', 'title_watched', 'passport_created', 'share_clicked', 'checkin_success',
  'postcard_made', 'layla_clicked', 'directions_clicked', 'request_created', 'screenshot_read',
  'trip_created', 'trip_joined', 'trip_shared', 'invite_shared', 'challenge_created', 'challenge_joined'
));

notify pgrst, 'reload schema';
