-- Hardening: a real Supabase project grants ALL privileges on every table in
-- "public" to the API roles by default (anon, authenticated). Row Level
-- Security already blocked writes through the API, but the design is
-- "read-only tables, every write through the game functions", so remove the
-- extra grants explicitly (defence in depth: TRUNCATE is not covered by RLS).
-- Found by a read-only check of the live project on 2026-11-17.

revoke all on table public.rooms, public.app_config from anon, authenticated;

grant select on table public.app_config to anon, authenticated;
grant select on table public.rooms to authenticated;

-- Performance advisor: index the rooms → levels foreign key.
create index if not exists rooms_level_id on public.rooms (level_id);
