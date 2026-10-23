-- Tests de l'outil À regarder : contraintes, notes personnelles, cache TMDB, accès.
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

create or replace function tests.severance() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-000000110002'::uuid $$;
create or replace function tests.past_lives() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-000000110001'::uuid $$;

do $$
begin
  perform tests.login('auriane@example.com');
  perform tests.throws(format(
    'insert into public.watch_item (household_id, title, kind, season_current) values (%L, ''Film'', ''movie'', 2)',
    tests.hh()), '23514', 'un film n''a pas de saison');
  perform tests.throws(format(
    'insert into public.watch_item (household_id, title, kind, media_id) values (%L, ''Doublon'', ''movie'', ''0192f000-0000-7000-8000-0000000f0001'')',
    tests.hh()), '23505', 'deux fois la même fiche TMDB');
  perform tests.throws(format(
    'insert into public.watch_platform (household_id, name, sort_order) values (%L, '' netflix '', 9)',
    tests.hh()), '23505', 'plateforme en double, casse et espaces ignorés');
  perform tests.throws(format(
    'insert into public.watch_rating (household_id, watch_item_id, rating) values (%L, %L, 6)',
    tests.hh(), tests.past_lives()), '23514', 'note sur 5');
  perform tests.ok('à regarder : progression, doublons et notes vérifiés');
end $$;

do $$
begin
  perform tests.login('auriane@example.com');
  begin
    update public.watch_item set status = 'watched' where id = tests.past_lives();
    perform tests.assert((select watched_at from public.watch_item where id = tests.past_lives()) is not null, 'vu daté');
    update public.watch_item set status = 'to_watch' where id = tests.past_lives();
    perform tests.assert((select watched_at from public.watch_item where id = tests.past_lives()) is null, 'date effacée');
    perform tests.assert(exists (select 1 from public.activity_log where entity_id = tests.past_lives() and tool_key = 'watchlist'),
      'journalisé côté À regarder');
    perform tests.ok('passer en « vu » date le visionnage, et l''activité est journalisée');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

do $$
declare
  v_aurelien uuid := tests.user_id('aurelien@example.com');
begin
  perform tests.login('auriane@example.com');
  perform tests.assert((select count(*) from public.watch_rating where watch_item_id = tests.severance()) = 2,
    'Auriane voit les deux notes');
  perform tests.throws(format(
    'insert into public.watch_rating (household_id, watch_item_id, user_id, rating) values (%L, %L, %L, 1)',
    tests.hh(), tests.past_lives(), v_aurelien), '42501', 'noter à la place d''Aurélien');
  perform tests.assert(tests.affected(format(
    'update public.watch_rating set rating = 1 where watch_item_id = %L and user_id = %L', tests.severance(), v_aurelien)) = 0,
    'modifier la note d''Aurélien');
  perform tests.throws(format(
    'insert into public.watch_rating (household_id, watch_item_id, rating) values (%L, %L, 3)',
    tests.hh(), tests.severance()), '23505', 'une seule note par personne');
  begin
    update public.watch_rating set rating = 5 where watch_item_id = tests.severance() and user_id = auth.uid();
    perform tests.assert((select rating from public.watch_rating where watch_item_id = tests.severance() and user_id = auth.uid()) = 5,
      'Auriane change sa note');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
  perform tests.ok('chacun note pour soi, une fois, et voit la note de l''autre');
end $$;

do $$
begin
  perform tests.login('auriane@example.com');
  perform tests.assert((select count(*) from public.external_media) >= 2, 'le cache se lit');
  perform tests.throws(
    'insert into public.external_media (media_type, external_id, title) values (''movie'', ''1'', ''Pirate'')',
    '42501', 'un membre n''écrit pas le cache');
  perform tests.throws('update public.external_media set title = ''Pirate''', '42501', 'un membre ne modifie pas le cache');
  perform tests.ok('cache TMDB : lecture pour tous, écriture par le service seulement');
end $$;

do $$
begin
  perform tests.login('intrus@example.com');
  perform tests.assert((select count(*) from public.watch_item) = 0, 'aucun titre');
  perform tests.assert((select count(*) from public.watch_rating) = 0, 'aucune note');
  perform tests.assert((select count(*) from public.watch_platform) = 0, 'aucune plateforme');
  perform tests.throws(format(
    'insert into public.watch_item (household_id, title, kind) values (%L, ''Pirate'', ''movie'')', tests.hh()),
    '42501', 'intrus ajoute un titre');
  perform tests.ok('à regarder invisible hors du foyer');
end $$;
