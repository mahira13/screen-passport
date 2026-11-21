-- The share link /p/[id] is public, so the id alone must not allow edits.
-- The creator's browser keeps a secret edit key; only its SHA-256 is stored here.
alter table public.passports add column edit_key_hash text;

-- Readers get the public fields only, never the key hash.
drop function public.get_passport(text);
create function public.get_passport(p_id text)
returns table (
  id text, display_name text, start_city text,
  watched text[], visited int[], created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.start_city, p.watched, p.visited, p.created_at, p.updated_at
  from public.passports p where p.id = p_id;
$$;
revoke execute on function public.get_passport(text) from public;
grant execute on function public.get_passport(text) to anon, authenticated, service_role;
