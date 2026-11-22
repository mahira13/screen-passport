-- Featured collections on Discover (featured_rank from 010). Run after 010. Safe to run more than once.
-- Ranks are unique, so clear them all first, then set the order.

update public.collections set featured_rank = null where featured_rank is not null;

update public.collections set featured_rank = 1 where id = 'netflix-berlin';  -- Streaming Berlin
update public.collections set featured_rank = 2 where id = 'cold-war-berlin'; -- Cold War Berlin
update public.collections set featured_rank = 3 where id = 'goerliwood';      -- Görliwood
-- Golden Twenties (1920s-berlin) stays unranked.
