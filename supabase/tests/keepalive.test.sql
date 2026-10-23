-- Test du ping anti-pause : appelable sans compte, ne donne accès à rien d'autre.

do $$
declare
  v jsonb;
begin
  perform tests.login_anon();
  v := public.ping();
  perform tests.assert((v ->> 'ok')::boolean, 'ping répond ok');
  perform tests.throws('select 1 from public.household', '42501', 'anon ne lit toujours aucun foyer');
  perform tests.logout();
  perform tests.ok('le ping anti-pause répond à anon sans ouvrir les données');
end $$;
