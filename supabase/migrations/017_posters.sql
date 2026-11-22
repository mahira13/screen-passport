-- Film and series posters, only from Wikimedia Commons with a free licence (product rule 6). Run after 016.
-- Safe to run more than once. poster_status: 'auto' (Claude says it is this title's poster),
-- 'approved'/'rejected' (a person decided), 'none' (looked, nothing usable found), null (not looked yet).
-- The app shows a poster only when it is 'auto' or 'approved'.

alter table public.works
  add column if not exists poster_url          text check (poster_url ~ '^https://upload\.wikimedia\.org/wikipedia/commons/'),
  add column if not exists poster_thumb_url    text check (poster_thumb_url ~ '^https://upload\.wikimedia\.org/wikipedia/commons/'),
  add column if not exists poster_author       text check (char_length(poster_author) <= 200),
  add column if not exists poster_license      text check (char_length(poster_license) <= 60),
  add column if not exists poster_license_url  text check (poster_license_url ~ '^https?://'),
  add column if not exists poster_page         text check (poster_page ~ '^https://commons\.wikimedia\.org/'),
  add column if not exists poster_status       text check (poster_status in ('auto', 'approved', 'rejected', 'none')),
  add column if not exists poster_check_reason text check (char_length(poster_check_reason) <= 300);

-- A shown poster always carries its full credit.
alter table public.works drop constraint if exists works_poster_credit_check;
alter table public.works add constraint works_poster_credit_check check (
  coalesce(poster_status, '') not in ('auto', 'approved')
  or (poster_thumb_url is not null and poster_author is not null and poster_license is not null and poster_page is not null));

notify pgrst, 'reload schema';
