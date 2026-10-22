-- =============================================================================
-- OhO · Lot 2 · Planification de la purge des pierres tombales (M1)
-- Tous les jours à 3 h 30 UTC, private.purge_tombstones() supprime les lignes
-- dont deleted_at a plus de 30 jours. Sans pg_cron (Postgres nu des tests),
-- la migration ne fait rien : la purge reste appelable à la main.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available, purge not scheduled';
    return;
  end if;

  create extension if not exists pg_cron;

  -- cron.schedule remplace un job du même nom : la migration est rejouable.
  perform cron.schedule(
    'oho_purge_tombstones',
    '30 3 * * *',
    $job$select private.purge_tombstones(interval '30 days')$job$
  );
end $$;
