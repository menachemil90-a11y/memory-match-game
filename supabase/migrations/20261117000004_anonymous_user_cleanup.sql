-- Data minimisation: online play signs players in anonymously. Anonymous
-- users that have not played for 30 days (and are not in any room) are
-- deleted daily. Skipped where Supabase Auth / pg_cron are unavailable.

create function private.cleanup_anonymous_users() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  n int := 0;
begin
  if to_regclass('auth.users') is null then
    return 0;
  end if;
  execute $sql$
    delete from auth.users u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
      and not exists (
        select 1 from public.rooms r where r.host_id = u.id or r.guest_id = u.id
      )
  $sql$;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function private.cleanup_anonymous_users() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'memory-match-cleanup-anonymous-users',
      '17 3 * * *',
      'select private.cleanup_anonymous_users();'
    );
  end if;
end $$;
