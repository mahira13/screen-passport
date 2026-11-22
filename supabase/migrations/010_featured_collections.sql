-- Featured collections on Discover: featured_rank not null, shown in ascending order.
-- Safe to run more than once. Run after 009.

alter table public.collections
  add column if not exists featured_rank int check (featured_rank > 0);

-- Two collections can't share a slot.
create unique index if not exists collections_featured_rank_key
  on public.collections (featured_rank) where featured_rank is not null;

notify pgrst, 'reload schema';
