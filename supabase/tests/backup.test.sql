-- Tests des sauvegardes : export, restauration à l'identique, accès ; journal d'erreurs.
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

-- Ce fichier passe avant rls.test.sql : il crée lui-même le compte hors espace.
do $$ begin perform tests.create_user('intrus@example.com', 'Intrus'); end $$;

do $$
declare
  v_before jsonb;
  v_after jsonb;
  v_counts jsonb;
  v_table text;
  v_list text[] := private.backup_tables() || array['external_media'];
begin
  begin
    perform tests.login('aurelien@example.com');
    v_before := public.export_household(tests.hh());
    perform tests.assert(v_before ->> 'format' = 'oho-export' and (v_before ->> 'version')::int = 1, 'format et version');
    perform tests.assert(jsonb_array_length(v_before -> 'members') = 2, 'les deux membres nommés');
    perform tests.assert(jsonb_array_length(v_before -> 'tables' -> 'checklist_item') > 0
      and jsonb_array_length(v_before -> 'tables' -> 'expense') > 0
      and jsonb_array_length(v_before -> 'tables' -> 'external_media') > 0, 'courses, dépenses et fiches TMDB exportées');

    -- Des dégâts : suppressions douces, modifications, suppressions physiques.
    update public.checklist_item set deleted_at = now() where household_id = tests.hh();
    update public.trip set title = 'Renommé', notes = 'abîmé' where household_id = tests.hh();
    update public.expense set deleted_at = now() where household_id = tests.hh();
    update public.household set name = 'Autre nom' where id = tests.hh();
    reset role;
    delete from public.watch_rating where household_id = tests.hh();
    delete from public.settlement where household_id = tests.hh();

    -- Une vraie restauration ouvre sa propre transaction : on vide les contrôles différés en attente.
    set constraints all immediate;
    set constraints all deferred;
    perform tests.login('aurelien@example.com');
    v_counts := public.import_household(v_before);
    perform tests.assert((v_counts ->> 'checklist_item')::int = jsonb_array_length(v_before -> 'tables' -> 'checklist_item'), 'chaque item réécrit');
    v_after := public.export_household(tests.hh());

    foreach v_table in array v_list loop
      perform tests.assert(v_after -> 'tables' -> v_table = v_before -> 'tables' -> v_table,
        format('%s restauré à l''identique', v_table));
    end loop;
    perform tests.assert(v_after -> 'household' = v_before -> 'household', 'nom de l''espace restauré, horodatage compris');
    perform tests.assert((select count(*) from public.activity_log where household_id = tests.hh() and action = 'imported') = 1
      and not exists (select 1 from public.activity_log where household_id = tests.hh() and action = 'restored'),
      'une seule ligne de journal pour la restauration');
    reset role;
    perform tests.assert(not exists (select 1 from public.push_digest), 'aucune notification pour une restauration');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('export → dégâts → import : l''espace revient à l''identique');
end $$;

do $$
declare
  v_export jsonb;
  v_hh uuid := tests.hh();
  v_ok boolean;
begin
  begin
    perform tests.login('auriane@example.com');
    v_export := public.export_household(tests.hh());
    perform tests.throws(format('select public.import_household(%L::jsonb)', jsonb_build_object('format', 'autre')), '22023', 'fichier qui n''est pas un export');
    perform tests.throws(format('select public.import_household(%L::jsonb)',
      jsonb_set(v_export, '{tables,trip,0,household_id}', to_jsonb(gen_random_uuid()::text))), '42501', 'ligne d''un autre espace');
    -- Un fichier ne peut pas réécrire le cache TMDB partagé.
    perform public.import_household(jsonb_set(v_export, '{tables,external_media,0,title}', '"Titre piégé"'));
    perform tests.assert(not exists (select 1 from public.external_media where title = 'Titre piégé'), 'cache TMDB intact');

    perform tests.login('intrus@example.com');
    perform tests.throws(format('select public.export_household(%L)', tests.hh()), '42501', 'intrus exporte l''espace');
    perform tests.throws(format('select public.import_household(%L::jsonb)', v_export), '42501', 'intrus restaure l''espace');

    -- Le service (fonction de sauvegarde) exporte sans compte.
    perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
    perform set_config('role', 'service_role', true);
    v_ok := public.export_household(v_hh) ->> 'household_id' = v_hh::text;
    reset role;
    perform tests.assert(v_ok, 'le service exporte');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('sauvegardes : réservées aux membres et au service, fichiers vérifiés');
end $$;

do $$
begin
  begin
    perform tests.login('auriane@example.com');
    insert into public.client_error (household_id, message, path, release) values (tests.hh(), 'TypeError: x is undefined', '/courses', '0.0.0');
    perform tests.login('aurelien@example.com');
    perform tests.assert((select count(*) from public.client_error) = 1, 'Aurélien lit les erreurs de l''espace');
    perform tests.throws(format('insert into public.client_error (household_id, user_id, message) values (%L, %L, ''x'')',
      tests.hh(), tests.user_id('auriane@example.com')), '42501', 'signaler au nom de l''autre');
    perform tests.throws(format('insert into public.client_error (household_id, message) values (%L, %L)', tests.hh(), repeat('x', 1001)),
      '23514', 'message trop long');
    perform tests.login('intrus@example.com');
    perform tests.throws(format('insert into public.client_error (household_id, message) values (%L, ''x'')', tests.hh()), '42501', 'intrus signale dans l''espace');
    reset role;
    update public.client_error set created_at = now() - interval '31 days';
    perform private.purge_client_errors();
    perform tests.assert(not exists (select 1 from public.client_error), 'purgé après 30 jours');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('journal d''erreurs : chacun signale pour soi, les membres lisent, purge à 30 jours');
end $$;
