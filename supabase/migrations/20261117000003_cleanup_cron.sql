-- Schedules the stale-room cleanup every 15 minutes (requires pg_cron, which
-- Supabase provides; skipped where the extension is unavailable).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'memory-match-cleanup-stale-rooms',
      '*/15 * * * *',
      'select private.cleanup_stale_rooms();'
    );
  end if;
end $$;
