-- Tests d'accès (RLS, privilèges, clés composites).
-- Prérequis : stub, migrations, seed, tests/helpers.sql.

-- Mise en place : un compte hors espace, et un second foyer « Chalet » dont
-- Aurélien est simple membre (pour éprouver les FK composites et les rôles).
do $$
declare
  v_aurelien uuid := tests.user_id('aurelien@example.com');
begin
  perform tests.create_user('intrus@example.com', 'Intrus');

  insert into public.household (id, name, timezone, created_by)
  values ('0192f000-0000-7000-8000-0000000000b1', 'Chalet', 'America/Toronto', v_aurelien);
  insert into public.membership (household_id, user_id, role, created_by)
  values ('0192f000-0000-7000-8000-0000000000b1', v_aurelien, 'member', v_aurelien);
  insert into public.checklist (id, household_id, kind, name, sort_order, created_by)
  values ('0192f000-0000-7000-8000-0000000000b2', '0192f000-0000-7000-8000-0000000000b1',
          'shopping', 'Chalet', 1, v_aurelien);
  insert into public.shopping_category (id, household_id, name, sort_order, created_by)
  values ('0192f000-0000-7000-8000-0000000000b3', '0192f000-0000-7000-8000-0000000000b1',
          'Bois', 1, v_aurelien);
end $$;

-- -----------------------------------------------------------------------------
-- Compte hors espace
-- -----------------------------------------------------------------------------
do $$
declare
  v_me uuid := tests.login('intrus@example.com');
  v_table text;
  v_count bigint;
begin
  for v_table in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('select count(*) from public.%I', v_table) into v_count;
    if v_table = 'profile' then
      perform tests.assert(v_count = 1, 'intrus ne voit que son propre profil, voit ' || v_count);
    elsif v_table = 'external_media' then
      -- Cache TMDB public, hors foyer : lisible par tout compte connecté (exception documentée).
      null;
    else
      perform tests.assert(v_count = 0, format('intrus voit %s ligne(s) de %s', v_count, v_table));
    end if;
  end loop;
  perform tests.assert((select id from public.profile) = v_me, 'le seul profil visible est le sien');
  perform tests.ok('un compte hors espace ne voit aucune ligne d''aucune table (hors son profil)');
end $$;

do $$
declare
  v_me uuid := tests.login('intrus@example.com');
  hh text := quote_literal(tests.hh());
  lst text := quote_literal(tests.list());
begin
  perform tests.throws('insert into public.household (name, timezone) values (''Pirate'', ''UTC'')',
    '42501', 'intrus insère un foyer en direct');
  perform tests.throws(format('insert into public.profile (id, display_name) values (%L, ''X'')', gen_random_uuid()),
    '42501', 'intrus insère un profil');
  perform tests.throws(format('insert into public.membership (household_id, user_id) values (%s, %L)', hh, v_me),
    '42501', 'intrus s''ajoute au foyer');
  perform tests.throws(format('insert into public.tool_activation (household_id, tool_key) values (%s, ''pirate'')', hh),
    '42501', 'intrus active un outil');
  perform tests.throws(format('insert into public.shopping_category (household_id, name, sort_order) values (%s, ''X'', 1)', hh),
    '42501', 'intrus crée un rayon');
  perform tests.throws(format('insert into public.catalog_item (household_id, label) values (%s, ''X'')', hh),
    '42501', 'intrus écrit au catalogue');
  perform tests.throws(format('insert into public.checklist (household_id, kind, name, sort_order) values (%s, ''shopping'', ''X'', 1)', hh),
    '42501', 'intrus crée une liste');
  perform tests.throws(format('insert into public.checklist_item (household_id, checklist_id, label, sort_order) values (%s, %s, ''X'', 1)', hh, lst),
    '42501', 'intrus ajoute un item');
  perform tests.throws(format('insert into public.activity_log (household_id, tool_key, action, entity_type, entity_id) values (%s, ''shopping'', ''created'', ''x'', %L)', hh, gen_random_uuid()),
    '42501', 'intrus écrit au journal');
  perform tests.ok('un compte hors espace ne peut rien insérer dans l''espace');
end $$;

do $$
declare
  v_me uuid := tests.login('intrus@example.com');
  hh text := quote_literal(tests.hh());
  v_table text;
begin
  perform tests.assert(tests.affected(format('update public.household set name = ''Pirate'' where id = %s', hh)) = 0,
    'intrus renomme le foyer');
  perform tests.assert(tests.affected(format('update public.profile set display_name = ''Pirate'' where id = %L',
      tests.user_id('auriane@example.com'))) = 0, 'intrus renomme Auriane');
  foreach v_table in array array['membership', 'tool_activation', 'shopping_category', 'catalog_item', 'checklist', 'checklist_item'] loop
    perform tests.assert(
      tests.affected(format('update public.%I set deleted_at = now() where household_id = %s', v_table, hh)) = 0,
      'intrus modifie ' || v_table);
  end loop;
  perform tests.throws(format('update public.activity_log set action = ''x'' where household_id = %s', hh),
    '42501', 'intrus modifie le journal');
  for v_table in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    perform tests.throws(format('delete from public.%I', v_table), '42501', 'intrus supprime dans ' || v_table);
  end loop;
  perform tests.ok('un compte hors espace ne peut rien modifier ni supprimer');
end $$;

-- Vérification côté superutilisateur : rien n'a bougé.
do $$
begin
  perform tests.assert((select name from public.household where id = tests.hh()) = 'Aurélien & Auriane', 'nom du foyer intact');
  perform tests.assert((select display_name from public.profile where id = tests.user_id('auriane@example.com')) = 'Auriane', 'profil intact');
  perform tests.assert(not exists (select 1 from public.checklist_item where household_id = tests.hh() and deleted_at is not null), 'items intacts');
  perform tests.ok('les données de l''espace sont intactes après les tentatives de l''intrus');
end $$;

-- Son propre foyer ne lui ouvre pas le nôtre ; une FK composite l'empêche d'y pointer.
do $$
declare
  v_me uuid := tests.login('intrus@example.com');
  v_hh uuid;
begin
  v_hh := public.create_household('Chez l''intrus', 'Europe/Paris');
  perform tests.assert((select count(*) from public.household) = 1, 'intrus voit son seul foyer');
  perform tests.assert((select role from public.membership where household_id = v_hh and user_id = v_me) = 'owner',
    'create_household fait du créateur un propriétaire');
  perform tests.assert((select count(*) from public.checklist_item) = 0, 'toujours aucun item visible');
  perform tests.throws(format(
      'insert into public.checklist_item (household_id, checklist_id, label, sort_order) values (%L, %L, ''X'', 1)',
      v_hh, tests.list()),
    '23503', 'intrus vise notre liste depuis son foyer');
  perform tests.ok('create_household fonctionne et n''ouvre rien d''autre');
end $$;

do $$
begin
  perform tests.login_anon();
  perform tests.throws('select count(*) from public.checklist_item', '42501', 'anon lit les items');
  perform tests.throws('select count(*) from public.profile', '42501', 'anon lit les profils');
  perform tests.throws('select public.create_household(''X'')', '42501', 'anon crée un foyer');
  perform tests.ok('le rôle anon n''a accès à rien');
end $$;

-- -----------------------------------------------------------------------------
-- Membres de l'espace
-- -----------------------------------------------------------------------------
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
begin
  perform tests.assert((select count(*) from public.household) = 1, 'Auriane voit son foyer');
  perform tests.assert((select count(*) from public.membership) = 2, 'Auriane voit les 2 adhésions');
  perform tests.assert((select count(*) from public.profile) = 2, 'Auriane voit les 2 profils');
  perform tests.assert((select count(*) from public.tool_activation) = 4, 'Auriane voit les 4 outils');
  perform tests.assert((select array_agg(tool_key order by sort_order) from public.tool_activation where enabled)
    = array['shopping', 'trips', 'watchlist'], 'Courses, Voyages et À regarder sont activés');
  perform tests.assert((select count(*) from public.checklist where is_default and name = 'Épicerie') = 1, 'liste Épicerie par défaut');
  perform tests.assert((select count(*) from public.checklist_item where checklist_id = tests.list()) = 7, 'Auriane voit les 7 items de l''épicerie');
  perform tests.assert((select count(*) from public.trip) = 1, 'Auriane voit le voyage du seed');
  perform tests.assert((select count(*) from public.shopping_category) = 7, 'Auriane voit les 7 rayons');
  perform tests.assert((select count(*) from public.catalog_item) = 7, 'le catalogue compte 7 articles');
  perform tests.assert((select count(*) from public.activity_log) > 0, 'Auriane lit le journal');
  perform tests.assert(not exists (select 1 from public.household where name = 'Chalet'), 'Auriane ne voit pas le Chalet');
  perform tests.ok('un membre voit les données de son espace, et seulement elles');
end $$;

do $$
declare
  v_me uuid := tests.login('auriane@example.com');
begin
  perform tests.assert(tests.affected(format('update public.household set name = ''Chez nous'' where id = %L', tests.hh())) = 1,
    'Auriane renomme le foyer');
  perform tests.assert(tests.affected('update public.tool_activation set enabled = true where tool_key = ''trips''') = 1,
    'Auriane active Voyages');
  perform tests.assert(tests.affected(format('update public.profile set avatar_color = ''#aabbcc'' where id = %L', v_me)) = 1,
    'Auriane modifie son profil');
  perform tests.assert(tests.affected(format('update public.profile set display_name = ''X'' where id = %L',
      tests.user_id('aurelien@example.com'))) = 0, 'Auriane ne modifie pas le profil d''Aurélien');
  insert into public.shopping_category (household_id, name, sort_order) values (tests.hh(), 'Boissons', 8);
  insert into public.checklist (household_id, kind, name, sort_order) values (tests.hh(), 'shopping', 'Pharmacie', 2);
  perform tests.ok('un membre crée et modifie les données de son espace');
end $$;

-- Remise en état (superutilisateur)
do $$
begin
  update public.household set name = 'Aurélien & Auriane' where id = tests.hh();
  update public.tool_activation set enabled = false where household_id = tests.hh() and tool_key = 'trips';
end $$;

-- -----------------------------------------------------------------------------
-- Clés étrangères composites : Aurélien est membre des deux foyers, la RLS le
-- laisserait passer ; seule la FK (household_id, id) l'arrête.
-- -----------------------------------------------------------------------------
do $$
declare
  v_me uuid := tests.login('aurelien@example.com');
  v_item uuid;
begin
  perform tests.assert((select count(*) from public.household) = 2, 'Aurélien voit ses deux foyers');
  perform tests.throws(format(
      'insert into public.checklist_item (household_id, checklist_id, label, sort_order) values (%L, %L, ''Bûches'', 1)',
      tests.hh(), '0192f000-0000-7000-8000-0000000000b2'),
    '23503', 'item de notre foyer dans la liste du Chalet');
  perform tests.throws(format(
      'insert into public.checklist_item (household_id, checklist_id, label, category_id, sort_order) values (%L, %L, ''Bûches'', %L, 1)',
      tests.hh(), tests.list(), '0192f000-0000-7000-8000-0000000000b3'),
    '23503', 'item de notre foyer dans un rayon du Chalet');

  select id into v_item from public.checklist_item where household_id = tests.hh() and label = 'Lait';
  perform tests.throws(format('update public.checklist_item set category_id = %L where id = %L',
      '0192f000-0000-7000-8000-0000000000b3', v_item),
    '23503', 'déplacer un item vers un rayon du Chalet');
  perform tests.throws(format('update public.checklist_item set household_id = %L where id = %L',
      '0192f000-0000-7000-8000-0000000000b1', v_item),
    '42501', 'changer le household_id d''un item');
  perform tests.ok('un item ne peut viser ni la liste ni le rayon d''un autre foyer');
end $$;

-- Rôles : un simple membre ne gère pas les adhésions ; une adhésion en pierre
-- tombale ferme l'accès.
do $$
declare
  v_me uuid := tests.login('aurelien@example.com');
begin
  perform tests.throws(format('insert into public.membership (household_id, user_id) values (%L, %L)',
      '0192f000-0000-7000-8000-0000000000b1', tests.user_id('auriane@example.com')),
    '42501', 'un simple membre ajoute quelqu''un');
  perform tests.assert(tests.affected(format(
      'update public.membership set role = ''owner'' where household_id = %L', '0192f000-0000-7000-8000-0000000000b1')) = 0,
    'un simple membre se promeut propriétaire');
  perform tests.ok('seuls les propriétaires gèrent les adhésions');
end $$;

do $$
declare
  v_me uuid := tests.user_id('aurelien@example.com');
begin
  update public.membership set deleted_at = now()
  where household_id = '0192f000-0000-7000-8000-0000000000b1' and user_id = v_me;
  perform tests.login('aurelien@example.com');
  perform tests.assert(not exists (select 1 from public.household where id = '0192f000-0000-7000-8000-0000000000b1'),
    'foyer quitté encore visible');
  perform tests.assert(not exists (select 1 from public.checklist where household_id = '0192f000-0000-7000-8000-0000000000b1'),
    'liste du foyer quitté encore visible');
  perform tests.assert((select count(*) from public.household) = 1, 'Aurélien garde son foyer principal');
  perform tests.ok('une adhésion supprimée (pierre tombale) ne donne plus accès');
end $$;

-- -----------------------------------------------------------------------------
-- Journal : lecture seule pour les membres, immuable pour tous
-- -----------------------------------------------------------------------------
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_log uuid;
begin
  select id into v_log from public.activity_log limit 1;
  perform tests.throws(format('insert into public.activity_log (household_id, tool_key, action, entity_type, entity_id) values (%L, ''shopping'', ''created'', ''x'', %L)',
      tests.hh(), gen_random_uuid()), '42501', 'membre écrit au journal');
  perform tests.throws(format('update public.activity_log set action = ''forged'' where id = %L', v_log),
    '42501', 'membre modifie le journal');
  perform tests.throws(format('delete from public.activity_log where id = %L', v_log),
    '42501', 'membre efface le journal');
  perform tests.logout();
  perform tests.throws(format('update public.activity_log set action = ''forged'' where id = %L', v_log),
    '42501', 'superutilisateur modifie le journal');
  perform tests.ok('activity_log n''est pas modifiable par un membre (ni par personne)');
end $$;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
begin
  perform tests.assert((
    select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  ) >= 13, 'les tables de foyer sont publiées pour Realtime');
  perform tests.assert(not exists (
    select 1 from pg_tables t where t.schemaname = 'public' and not t.rowsecurity
  ), 'toutes les tables public ont la RLS activée');
  perform tests.ok('RLS activée partout, tables publiées pour Realtime');
end $$;
