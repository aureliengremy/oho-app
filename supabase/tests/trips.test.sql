-- Tests de l'outil Voyages : contraintes, checklist de préparation, pièces jointes, accès.
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

create or replace function tests.trip() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-0000000e0001'::uuid $$;

do $$
begin
  perform tests.login('auriane@example.com');
  perform tests.throws(format(
    'insert into public.trip (household_id, title, start_date, end_date) values (%L, ''X'', ''2026-11-10'', ''2026-11-01'')',
    tests.hh()), '23514', 'fin avant le début');
  perform tests.throws(format(
    'insert into public.booking (household_id, trip_id, kind, title, amount) values (%L, %L, ''lodging'', ''Hôtel'', 100)',
    tests.hh(), tests.trip()), '23514', 'montant sans devise');
  perform tests.throws(format(
    'insert into public.booking (household_id, trip_id, kind, title, tz) values (%L, %L, ''train'', ''Train'', ''Lune/Mer'')',
    tests.hh(), tests.trip()), '23514', 'fuseau inconnu');
  perform tests.throws(format(
    'insert into public.trip_activity (household_id, trip_id, title, url, sort_order) values (%L, %L, ''X'', ''javascript:alert(1)'', 1)',
    tests.hh(), tests.trip()), '23514', 'lien non http');
  perform tests.ok('voyages : dates, devise, fuseau et liens vérifiés');
end $$;

do $$
begin
  perform tests.login('auriane@example.com');
  perform tests.throws(format(
    'insert into public.checklist (household_id, kind, name, sort_order, trip_id) values (%L, ''shopping'', ''X'', 9, %L)',
    tests.hh(), tests.trip()), '23514', 'une liste de courses ne vise pas un voyage');
  perform tests.throws(format(
    'insert into public.checklist (household_id, kind, name, sort_order, trip_id) values (%L, ''trip_prep'', ''Bis'', 9, %L)',
    tests.hh(), tests.trip()), '23505', 'une seule checklist de préparation par voyage');
  perform tests.ok('checklist.trip_id : seulement trip_prep, une par voyage');
end $$;

do $$
declare
  v_item uuid;
begin
  perform tests.login('aurelien@example.com');
  begin
    insert into public.checklist_item (household_id, checklist_id, label, sort_order)
    values (tests.hh(), '0192f000-0000-7000-8000-0000000d0002', 'Crème solaire', 9)
    returning id into v_item;
    perform tests.assert(exists (select 1 from public.activity_log
      where entity_id = v_item and tool_key = 'trips' and action = 'created'), 'journalisé côté Voyages');
    perform tests.assert(not exists (select 1 from public.catalog_item where label_key = 'crème solaire'),
      'la valise n''alimente pas le catalogue des courses');
    perform tests.ok('un item de valise est journalisé côté Voyages, hors catalogue');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

do $$
declare
  v_booking uuid := private.uuid_generate_v7();
  v_att uuid := private.uuid_generate_v7();
begin
  perform tests.login('aurelien@example.com');
  begin
    insert into public.booking (id, household_id, trip_id, kind, title) values (v_booking, tests.hh(), tests.trip(), 'lodging', 'Alfama');
    perform tests.throws(format(
      'insert into public.attachment (household_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes) values (%L, ''booking'', %L, ''autre/chemin'', ''a.pdf'', ''application/pdf'', 10)',
      tests.hh(), v_booking), '23514', 'chemin hors du foyer refusé');
    insert into public.attachment (id, household_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes)
    values (v_att, tests.hh(), 'booking', v_booking,
            format('%s/booking/%s/%s', tests.hh(), v_booking, v_att), 'confirmation.pdf', 'application/pdf', 88000);
    perform tests.throws(format(
      'update public.attachment set size_bytes = %s where id = %L', 21 * 1024 * 1024, v_att), '23514', 'plus de 20 Mo refusé');

    update public.booking set deleted_at = now() where id = v_booking;
    perform tests.assert((select deleted_at from public.attachment where id = v_att) is not null,
      'supprimer la réservation marque sa pièce jointe');
    perform tests.ok('pièces jointes : chemin du foyer, 20 Mo, suppression en cascade');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

do $$
begin
  perform tests.create_user('intrus@example.com', 'Intrus');
  perform tests.login('intrus@example.com');
  perform tests.assert((select count(*) from public.trip) = 0, 'l''intrus ne voit aucun voyage');
  perform tests.assert((select count(*) from public.booking) = 0, 'ni réservation');
  perform tests.assert((select count(*) from public.trip_activity) = 0, 'ni idée');
  perform tests.throws(format(
    'insert into public.trip (household_id, title) values (%L, ''Pirate'')', tests.hh()), '42501', 'écriture refusée');
  perform tests.ok('voyages invisibles hors du foyer');
end $$;
