-- =============================================================================
-- Ping anti-pause : en palier gratuit, Supabase met en pause un projet resté
-- une semaine sans activité. Le workflow .github/workflows/keepalive.yml appelle
-- cette RPC tous les 3 jours avec la clé anon. Elle ne lit aucune donnée.
-- =============================================================================

create or replace function public.ping()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'at', now());
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated, service_role;
