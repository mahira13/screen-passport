-- Hand-picked collections: a curated collection can list its places one by one (collection_items)
-- instead of taking every place of its titles, and can be kept unpublished until it qualifies.
-- Run after 017. Safe to run more than once.

alter table public.collections
  add column if not exists published boolean not null default true;

create table if not exists public.collection_items (
  collection_id text not null references public.collections(id) on delete cascade,
  location_id   int  not null references public.locations(id) on delete cascade,
  position      int  not null check (position > 0),
  primary key (collection_id, location_id)
);
create index if not exists collection_items_location on public.collection_items (location_id);

-- Public read like collections; writes only through the service role (as in 016).
alter table public.collection_items enable row level security;
drop policy if exists "collection items are public" on public.collection_items;
create policy "collection items are public" on public.collection_items for select using (true);
revoke insert, update, delete, truncate, references, trigger on public.collection_items from anon, authenticated;
grant select on public.collection_items to anon, authenticated;
grant select, insert, update, delete on public.collection_items to service_role;

notify pgrst, 'reload schema';
