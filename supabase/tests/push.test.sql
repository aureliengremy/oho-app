-- Tests des notifications push : regroupement, anti-spam, préférences, envoi, accès.
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

-- Ce fichier passe avant rls.test.sql : il crée lui-même le compte hors espace.
do $$ begin perform tests.create_user('intrus@example.com', 'Intrus'); end $$;

do $$
declare
  v_al uuid := tests.user_id('aurelien@example.com');
  v_an uuid := tests.user_id('auriane@example.com');
  v_digest record;
  v_claim record;
begin
  begin
    perform tests.login('aurelien@example.com');
    perform public.register_push('https://push.example.com/aurelien-pixel', repeat('k', 40), repeat('a', 16), 'Pixel 8, Chrome');
    perform tests.login('auriane@example.com');
    perform public.register_push('https://push.example.com/auriane-iphone', repeat('k', 40), repeat('a', 16), 'iPhone, Safari');

    -- Auriane ajoute trois articles et en coche un : Aurélien reçoit un seul résumé, elle rien.
    insert into public.checklist_item (household_id, checklist_id, label, sort_order) values
      (tests.hh(), tests.list(), 'Lait', 100), (tests.hh(), tests.list(), 'Pain', 101), (tests.hh(), tests.list(), 'Avocats', 102);
    update public.checklist_item set checked = true where label = 'Lait' and checklist_id = tests.list() and sort_order = 100;
    reset role;
    perform tests.assert((select count(*) from public.push_digest) = 1, 'un seul résumé ouvert');
    select * into v_digest from public.push_digest;
    perform tests.assert(v_digest.user_id = v_al, 'pour Aurélien, pas pour l''autrice');
    perform tests.assert(v_digest.item_count = 3 and v_digest.labels = array['Lait', 'Pain', 'Avocats'], 'trois ajouts, cocher ne compte pas');
    perform tests.assert(v_digest.actor_ids = array[v_an] and v_digest.tool_key = 'shopping', 'qui et quel outil');
    perform tests.assert(v_digest.due_at between now() + interval '4 minutes' and now() + interval '6 minutes', 'regroupé sur 5 minutes');

    -- Pas encore échu : rien à envoyer. Échu : rendu une fois avec l'appareil, puis plus rien.
    perform tests.assert((select count(*) from public.claim_push_digests()) = 0, 'rien avant l''échéance');
    update public.push_digest set due_at = now() - interval '1 second';
    select * into v_claim from public.claim_push_digests();
    perform tests.assert(v_claim.actor_names = array['Auriane'] and v_claim.item_count = 3, 'résumé rendu avec le prénom');
    perform tests.assert(jsonb_array_length(v_claim.subscriptions) = 1
      and v_claim.subscriptions -> 0 ->> 'endpoint' = 'https://push.example.com/aurelien-pixel', 'vers le seul appareil d''Aurélien');
    perform tests.assert((select count(*) from public.claim_push_digests()) = 0, 'pris une seule fois');

    -- Un nouvel ajout ouvre un nouveau résumé.
    perform tests.login('auriane@example.com');
    insert into public.checklist_item (household_id, checklist_id, label, sort_order) values (tests.hh(), tests.list(), 'Café', 103);
    reset role;
    perform tests.assert((select count(*) from public.push_digest where sent_at is null) = 1, 'nouveau résumé après l''envoi');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('push : un résumé par outil pour l''autre membre, jamais pour soi, seulement les ajouts');
end $$;

do $$
declare
  v_al uuid := tests.user_id('aurelien@example.com');
begin
  begin
    perform tests.login('aurelien@example.com');
    perform public.register_push('https://push.example.com/aurelien-pixel', repeat('k', 40), repeat('a', 16));
    -- Aurélien coupe les Courses, garde Voyages en immédiat.
    insert into public.notification_pref (household_id, user_id, tool_key, enabled) values (tests.hh(), v_al, 'shopping', false);
    insert into public.notification_pref (household_id, user_id, tool_key, digest_minutes) values (tests.hh(), v_al, 'trips', 0);
    perform tests.login('auriane@example.com');
    insert into public.checklist_item (household_id, checklist_id, label, sort_order) values (tests.hh(), tests.list(), 'Thé', 104);
    insert into public.trip (household_id, title, status) values (tests.hh(), 'Japon', 'idea');
    reset role;
    perform tests.assert(not exists (select 1 from public.push_digest where tool_key = 'shopping'), 'outil coupé : rien');
    perform tests.assert((select due_at <= now() from public.push_digest where tool_key = 'trips'), 'immédiat : échu tout de suite');

    -- Outil désactivé pour l'espace : plus rien non plus.
    update public.tool_activation set enabled = false where household_id = tests.hh() and tool_key = 'trips';
    delete from public.push_digest;
    perform tests.login('auriane@example.com');
    insert into public.trip (household_id, title, status) values (tests.hh(), 'Islande', 'idea');
    reset role;
    perform tests.assert(not exists (select 1 from public.push_digest), 'outil désactivé : rien');

    -- Sans appareil abonné, pas de résumé.
    delete from public.push_subscription;
    update public.tool_activation set enabled = true where household_id = tests.hh() and tool_key = 'trips';
    perform tests.login('auriane@example.com');
    insert into public.trip (household_id, title, status) values (tests.hh(), 'Écosse', 'idea');
    reset role;
    perform tests.assert(not exists (select 1 from public.push_digest), 'sans appareil : rien');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('push : préférences par outil, outil désactivé, appareil requis');
end $$;

do $$
declare
  v_id uuid;
begin
  begin
    perform tests.login('aurelien@example.com');
    v_id := public.register_push('https://push.example.com/tablette', repeat('k', 40), repeat('a', 16));
    perform tests.assert((select count(*) from public.push_subscription) = 1, 'Aurélien voit son appareil');
    -- La même tablette passe au compte d'Auriane : elle change de propriétaire.
    perform tests.login('auriane@example.com');
    perform tests.assert(public.register_push('https://push.example.com/tablette', repeat('m', 40), repeat('b', 16)) = v_id, 'même ligne');
    perform tests.login('aurelien@example.com');
    perform tests.assert((select count(*) from public.push_subscription) = 0, 'plus à Aurélien');
    perform tests.throws(format('insert into public.push_subscription (user_id, endpoint, p256dh, auth) values (%L, ''https://x'', %L, %L)',
      tests.user_id('aurelien@example.com'), repeat('k', 40), repeat('a', 16)), '42501', 'insertion directe refusée');
    perform tests.throws('select public.claim_push_digests()', '42501', 'un membre ne vide pas la file');
    perform tests.throws(format('insert into public.notification_pref (household_id, user_id, tool_key) values (%L, %L, ''shopping'')',
      tests.hh(), tests.user_id('auriane@example.com')), '42501', 'préférence pour l''autre');

    -- Rapport d'envoi : 410 retire l'appareil, trois échecs aussi.
    reset role;
    perform public.report_push('{}', '{}', array[v_id]);
    perform public.report_push('{}', '{}', array[v_id]);
    perform tests.assert((select failure_count from public.push_subscription where id = v_id) = 2, 'deux échecs comptés');
    perform public.report_push(array[v_id], '{}', '{}');
    perform tests.assert((select failure_count from public.push_subscription where id = v_id) = 0, 'un succès remet à zéro');
    perform public.report_push('{}', array[v_id], '{}');
    perform tests.assert(not exists (select 1 from public.push_subscription where id = v_id), '410 : appareil retiré');

    perform tests.login('intrus@example.com');
    perform tests.throws(format('insert into public.notification_pref (household_id, user_id, tool_key) values (%L, %L, ''shopping'')',
      tests.hh(), tests.user_id('intrus@example.com')), '42501', 'intrus règle ses push sur l''espace');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('push : appareils et préférences à soi, file et rapport réservés au service');
end $$;
