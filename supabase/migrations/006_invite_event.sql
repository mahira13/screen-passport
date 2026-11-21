-- Analytics event for the trip invite card. Safe to run twice.
alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'map_viewed', 'title_watched', 'passport_created', 'share_clicked',
  'checkin_success', 'postcard_made', 'layla_clicked', 'directions_clicked',
  'request_created', 'screenshot_read', 'trip_created', 'trip_joined', 'trip_shared', 'invite_shared'
));
