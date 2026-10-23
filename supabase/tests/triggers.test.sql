-- Tests des triggers et conventions : profil, catalogue, horodatage, cochage,
-- journal, pierres tombales, purge, UUID v7.

do $$
declare
  v_id uuid;
begin
  v_id := tests.create_user('nouvelle@example.com', 'Nouvelle');
  perform tests.assert(exists (select 1 from public.profile where id = v_id and display_name = 'Nouvelle' and locale = 'fr'),
    'profil créé avec le nom des métadonnées');
  v_id := tests.create_user('sans.nom@example.com');
  perform tests.assert((select display_name from public.profile where id = v_id) = 'sans.nom',
    'profil créé avec le début du courriel');
  perform tests.assert((select display_name from public.profile where id = tests.user_id('auriane@example.com')) = 'Auriane',
    'profil du seed : Auriane');
  perform tests.ok('un nouvel auth.users crée son profile');
end $$;

do $$
begin
  perform tests.assert((select count(*) from public.catalog_item where household_id = tests.hh()) = 7,
    'le seed a alimenté le catalogue');
  perform tests.assert((
    select bool_and(i.catalog_item_id = c.id)
    from public.checklist_item i join public.catalog_item c on c.label_key = lower(i.label)
    where i.checklist_id = tests.list()
  ), 'chaque item du seed pointe vers son article');
  perform tests.ok('le seed alimente le catalogue par trigger');
end $$;

do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_item public.checklist_item;
  v_cat public.catalog_item;
begin
  -- Même article, autre casse et espaces : pas de doublon, compteur +1, rayon proposé.
  insert into public.checklist_item (household_id, checklist_id, label, sort_order)
  values (tests.hh(), tests.list(), '  LAIT ', 10)
  returning * into v_item;
  select * into v_cat from public.catalog_item where household_id = tests.hh() and label_key = 'lait';
  perform tests.assert(v_cat.usage_count = 2, 'usage_count passe à 2, vaut ' || v_cat.usage_count);
  perform tests.assert(v_cat.label = 'Lait', 'le libellé du catalogue garde la première saisie');
  perform tests.assert(v_item.catalog_item_id = v_cat.id, 'catalog_item_id renseigné');
  perform tests.assert(v_item.category_id = '0192f000-0000-7000-8000-0000000c0003', 'rayon proposé par le catalogue');
  perform tests.assert((select count(*) from public.catalog_item where label_key = 'lait') = 1, 'pas de doublon');

  -- Article nouveau : créé avec usage 1 et le rayon saisi.
  insert into public.checklist_item (household_id, checklist_id, label, category_id, sort_order)
  values (tests.hh(), tests.list(), 'Kiwis', '0192f000-0000-7000-8000-0000000c0001', 11)
  returning * into v_item;
  select * into v_cat from public.catalog_item where household_id = tests.hh() and label_key = 'kiwis';
  perform tests.assert(v_cat.usage_count = 1 and v_cat.last_used_at is not null, 'nouvel article appris');
  perform tests.assert(v_cat.default_category_id = '0192f000-0000-7000-8000-0000000c0001', 'rayon appris');
  perform tests.assert(v_cat.created_by = v_me, 'article créé au nom d''Auriane');
  perform tests.ok('le catalogue s''alimente à l''ajout d''un item (lower + btrim, rayon proposé)');
end $$;

do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_list uuid;
begin
  -- Une liste générique n'alimente pas le catalogue des courses.
  insert into public.checklist (household_id, kind, name, sort_order)
  values (tests.hh(), 'generic', 'À faire', 3) returning id into v_list;
  insert into public.checklist_item (household_id, checklist_id, label, sort_order)
  values (tests.hh(), v_list, 'Appeler le plombier', 1);
  perform tests.assert(not exists (select 1 from public.catalog_item where label_key = 'appeler le plombier'),
    'une liste generic n''apprend pas');
  perform tests.ok('seules les listes shopping alimentent le catalogue');
end $$;

-- created_by ne s'usurpe pas ; created_* sont figés.
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_aurelien uuid := tests.user_id('aurelien@example.com');
  v_item public.checklist_item;
begin
  insert into public.checklist_item (household_id, checklist_id, label, sort_order, created_by)
  values (tests.hh(), tests.list(), 'Beurre', 12, v_aurelien)
  returning * into v_item;
  perform tests.assert(v_item.created_by = v_me and v_item.updated_by = v_me, 'created_by forcé à auth.uid()');
  update public.checklist_item set created_by = v_aurelien, created_at = '2000-01-01' where id = v_item.id
  returning * into v_item;
  perform tests.assert(v_item.created_by = v_me and v_item.created_at > '2001-01-01', 'created_* figés');
  perform tests.ok('created_by est posé par le serveur et ne se réécrit pas');
end $$;

-- updated_at bouge à la mise à jour (deux transactions, now() change).
do $$
begin
  perform set_config('tests.before', (select updated_at::text from public.checklist_item where label = 'Pommes'), false);
  perform pg_sleep(0.01);
end $$;

do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_item public.checklist_item;
begin
  update public.checklist_item set quantity = '8' where label = 'Pommes' returning * into v_item;
  perform tests.assert(v_item.updated_at > current_setting('tests.before')::timestamptz, 'updated_at avance');
  perform tests.assert(v_item.updated_by = v_me, 'updated_by = Auriane');
  perform tests.ok('updated_at et updated_by sont posés par trigger à la mise à jour');
end $$;

-- Cocher / décocher
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_item public.checklist_item;
begin
  update public.checklist_item set checked = true where label = 'Bananes' returning * into v_item;
  perform tests.assert(v_item.checked_by = v_me and v_item.checked_at is not null, 'coché par Auriane');
  perform tests.assert((select action from public.activity_log where entity_id = v_item.id order by id desc limit 1) = 'checked',
    'journal : checked');
  update public.checklist_item set checked = false where id = v_item.id returning * into v_item;
  perform tests.assert(v_item.checked_by is null and v_item.checked_at is null, 'décoché');
  perform tests.assert((select action from public.activity_log where entity_id = v_item.id order by id desc limit 1) = 'unchecked',
    'journal : unchecked');
  perform tests.assert((select checked_by from public.checklist_item where label = 'Papier toilette')
    = tests.user_id('auriane@example.com'), 'item coché du seed attribué à son auteur');
  perform tests.ok('stamp_checked pose et vide checked_by / checked_at');
end $$;

-- Journal
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_item public.checklist_item;
  v_n bigint;
  v_log public.activity_log;
begin
  insert into public.checklist_item (household_id, checklist_id, label, sort_order)
  values (tests.hh(), tests.list(), 'Yogourt', 13) returning * into v_item;
  select * into v_log from public.activity_log where entity_id = v_item.id;
  perform tests.assert(v_log.action = 'created' and v_log.actor_id = v_me and v_log.tool_key = 'shopping'
    and v_log.entity_type = 'checklist_item' and v_log.entity_label = 'Yogourt', 'entrée created complète');

  select count(*) into v_n from public.activity_log where entity_id = v_item.id;
  update public.checklist_item set sort_order = 13.5 where id = v_item.id;
  perform tests.assert((select count(*) from public.activity_log where entity_id = v_item.id) = v_n,
    'un changement de sort_order seul n''est pas journalisé');

  update public.checklist_item set quantity = '2' where id = v_item.id;
  select * into v_log from public.activity_log where entity_id = v_item.id order by id desc limit 1;
  perform tests.assert(v_log.action = 'updated'
    and v_log.payload -> 'quantity' = '{"old": null, "new": "2"}'::jsonb, 'payload ancien / nouveau');
  perform tests.ok('log_activity journalise avec acteur, libellé et diff, et ignore sort_order seul');
end $$;

-- Pierres tombales
do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_item public.checklist_item;
  v_cat uuid;
begin
  update public.checklist_item set deleted_at = now() where label = 'Café' returning * into v_item;
  perform tests.assert(v_item.deleted_at is not null, 'item marqué supprimé');
  perform tests.assert(exists (select 1 from public.checklist_item where id = v_item.id and deleted_at is not null),
    'la pierre tombale reste lisible pour la synchronisation');
  perform tests.assert((select count(*) from public.checklist_item where checklist_id = tests.list() and deleted_at is null)
    = (select count(*) from public.checklist_item where checklist_id = tests.list()) - 1,
    'le filtre deleted_at is null masque l''item');
  perform tests.assert((select action || ':' || entity_label from public.activity_log where entity_id = v_item.id order by id desc limit 1)
    = 'deleted:Café', 'journal : deleted, libellé gardé');
  perform tests.throws(format('delete from public.checklist_item where id = %L', v_item.id), '42501',
    'suppression physique par un membre');

  update public.checklist_item set deleted_at = null where id = v_item.id;
  perform tests.assert((select action from public.activity_log where entity_id = v_item.id order by id desc limit 1) = 'restored',
    'journal : restored');

  -- L'unicité est partielle : un rayon supprimé n'empêche pas de le recréer.
  update public.shopping_category set deleted_at = now() where name = 'Surgelés' returning id into v_cat;
  insert into public.shopping_category (household_id, name, sort_order) values (tests.hh(), 'surgelés', 6);
  perform tests.throws(format('insert into public.shopping_category (household_id, name, sort_order) values (%L, ''SURGELÉS'', 6)', tests.hh()),
    '23505', 'doublon de rayon vivant');
  perform tests.ok('suppression douce : UPDATE de deleted_at, visible pour la synchro, filtrée par le client');
end $$;

-- Purge (superutilisateur, comme pg_cron)
do $$
declare
  v_old uuid;
  v_recent uuid;
  v_purged bigint;
  v_logs bigint;
begin
  update public.checklist_item set deleted_at = now() - interval '31 days' where label = 'Beurre' returning id into v_old;
  update public.checklist_item set deleted_at = now() - interval '2 days' where label = 'Kiwis' returning id into v_recent;
  select count(*) into v_logs from public.activity_log;
  v_purged := private.purge_tombstones();
  perform tests.assert(v_purged >= 1, 'au moins une ligne purgée');
  perform tests.assert(not exists (select 1 from public.checklist_item where id = v_old), 'vieille pierre tombale purgée');
  perform tests.assert(exists (select 1 from public.checklist_item where id = v_recent), 'pierre tombale récente gardée');
  perform tests.assert((select count(*) from public.activity_log) = v_logs, 'la purge n''écrit pas au journal');
  perform tests.ok('purge_tombstones supprime les pierres tombales de plus de 30 jours');
end $$;

-- Purge d'un foyer : la cascade nettoie tout sans écrire au journal.
do $$
declare
  v_hh uuid := '0192f000-0000-7000-8000-0000000000b1';
begin
  update public.household set deleted_at = now() - interval '40 days' where id = v_hh;
  perform private.purge_tombstones();
  perform tests.assert(not exists (select 1 from public.checklist where household_id = v_hh), 'listes du foyer purgées');
  perform tests.assert(not exists (select 1 from public.membership where household_id = v_hh), 'adhésions purgées');
  perform tests.assert(not exists (select 1 from public.activity_log where household_id = v_hh), 'journal du foyer purgé');
  perform tests.ok('purger un foyer emporte ses lignes par cascade');
end $$;

do $$
declare
  a uuid := private.uuid_generate_v7();
  b uuid;
begin
  perform pg_sleep(0.002);
  b := private.uuid_generate_v7();
  perform tests.assert(substr(a::text, 15, 1) = '7', 'version 7');
  perform tests.assert(substr(a::text, 20, 1) in ('8', '9', 'a', 'b'), 'variante RFC 4122');
  perform tests.assert(a < b, 'ordonnés dans le temps');
  perform tests.assert(abs(extract(epoch from now()) * 1000
    - ('x' || lpad(replace(left(a::text, 13), '-', ''), 16, '0'))::bit(64)::bigint) < 60000, 'horodatage lisible');
  perform tests.ok('uuid_generate_v7 produit des UUID v7 ordonnés');
end $$;

-- Fuseau
do $$
begin
  perform tests.throws('insert into public.household (name, timezone) values (''X'', ''Mars/Olympus'')', '23514', 'fuseau inconnu');
  perform tests.ok('household.timezone exige un fuseau IANA');
end $$;

do $$
begin
  perform tests.assert((select initials from public.profile where id = tests.user_id('aurelien@example.com')) = 'AL',
    'initiales du seed : AL');
  perform tests.assert((select initials from public.profile where id = tests.user_id('auriane@example.com')) = 'AN',
    'initiales du seed : AN');
  perform tests.throws(format('update public.profile set initials = %L where id = %L', 'al', tests.user_id('auriane@example.com')),
    '23514', 'initiales en minuscules refusées');
  perform tests.ok('profile.initials : AL et AN au seed, majuscules imposées');
end $$;
