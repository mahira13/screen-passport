-- Search that ignores accents and German spellings: ä/ae, ö/oe, ü/ue and ß/ss all match, so
-- "gorl", "goerl" and "görl" all find Görlitz. Query and searchable text go through the same
-- search_norm(); titles are searched together with their aliases (DE/EN). Run after 010.
-- Safe to run more than once.
--
-- Checks (run after applying; each should return the expected first row):
--   select kind, id from search_catalogue('gorl')       limit 1;  -- city, Görlitz
--   select kind, id from search_catalogue('goerl')      limit 1;  -- city, Görlitz
--   select kind, id from search_catalogue('görl')       limit 1;  -- city, Görlitz
--   select kind, id from search_catalogue('GÖRLITZ')    limit 1;  -- city, Görlitz
--   select kind, id from search_catalogue('damengambit') limit 1; -- work, queens-gambit (German alias)
--   select kind, id from search_catalogue('babylon')    limit 1;  -- work, babylon-berlin
--   select kind, id from search_catalogue('de')         limit 1;  -- country, DE (country code)
--   select public.search_norm('Straße Görlitz Müller');            -- 'strasse gorlitz muller'

set search_path = public, extensions;

create extension if not exists unaccent with schema extensions;

-- lower → unaccent (ä→a, ß→ss, é→e) → German transliterations (ae→a, oe→o, ue→u).
-- Applied to both sides, so a match never depends on how a word was typed. unaccent() itself is
-- only STABLE; naming the dictionary explicitly makes this wrapper safe to declare IMMUTABLE,
-- which lets it be used in an index.
create or replace function public.search_norm(t text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, lower(t)),
         'ae', 'a'), 'oe', 'o'), 'ue', 'u');
$$;

-- A title with its aliases, as one normalised text.
create or replace function public.work_search_text(title text, aliases text[]) returns text
language sql immutable parallel safe set search_path = '' as $$
  select public.search_norm(coalesce(title, '') || ' ' || coalesce(array_to_string(aliases, ' '), ''));
$$;

create index if not exists works_search_trgm
  on public.works using gin (public.work_search_text(title, aliases) extensions.gin_trgm_ops);

-- Same signature and results shape as 007; only matching and scoring change.
create or replace function public.search_catalogue(q text)
returns table (kind text, id text, label text, places int, score real)
language sql stable security invoker set search_path = public, extensions as $$
  with term as (select public.search_norm(trim(coalesce(q, ''))) as t, lower(trim(coalesce(q, ''))) as raw),
  pub as (select * from public.catalogue_entries),
  hits as (
    select 'work'::text as kind, w.id, w.title as label, count(distinct p.id)::int as places,
           greatest(similarity(public.search_norm(w.title), t.t),
                    coalesce((select max(similarity(public.search_norm(a), t.t)) from unnest(w.aliases) a), 0),
                    word_similarity(t.t, public.work_search_text(w.title, w.aliases))) as score
    from public.works w join pub p on p.work_id = w.id, term t
    where length(t.t) >= 2
      and (public.work_search_text(w.title, w.aliases) like '%' || t.t || '%'
           or t.t <% public.work_search_text(w.title, w.aliases))
    group by w.id, w.title, w.aliases, t.t
    union all
    select 'city', p.city, p.city, count(distinct p.id)::int,
           greatest(similarity(public.search_norm(p.city), t.t), word_similarity(t.t, public.search_norm(p.city)))
    from pub p, term t
    where p.city is not null and length(t.t) >= 2
      and (public.search_norm(p.city) like '%' || t.t || '%' or t.t <% public.search_norm(p.city))
    group by p.city, t.t
    union all
    select 'country', p.country_code, p.country, count(distinct p.id)::int,
           case when lower(p.country_code) = t.raw then 1
                else greatest(similarity(public.search_norm(p.country), t.t), word_similarity(t.t, public.search_norm(p.country))) end
    from pub p, term t
    where p.country is not null and length(t.t) >= 2
      and (public.search_norm(p.country) like '%' || t.t || '%' or t.t <% public.search_norm(p.country)
           or lower(p.country_code) = t.raw)
    group by p.country_code, p.country, t.t, t.raw
  )
  select kind, id, label, places, score from hits order by score desc, places desc, label limit 20;
$$;
grant execute on function public.search_catalogue(text) to anon, authenticated, service_role;
grant execute on function public.search_norm(text), public.work_search_text(text, text[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
