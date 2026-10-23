-- Tests de l'outil Courses : vider les cochés (clear_checked).
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

do $$
declare
  v_me uuid := tests.login('auriane@example.com');
  v_count integer;
  v_log public.activity_log;
begin
  begin
    update public.checklist_item set checked = true
     where checklist_id = tests.list() and label in ('Pommes', 'Bananes');

    v_count := public.clear_checked(tests.list());
    perform tests.assert(v_count = 3, 'trois items rangés (deux cochés + Papier toilette), vaut ' || v_count);
    perform tests.assert(not exists (
      select 1 from public.checklist_item
      where checklist_id = tests.list() and checked and deleted_at is null), 'plus aucun coché vivant');
    perform tests.assert((select count(*) from public.checklist_item
      where checklist_id = tests.list() and deleted_at is null) = 4, 'les quatre non cochés restent');

    select * into v_log from public.activity_log
     where household_id = tests.hh() and created_at = now() and entity_type = 'checklist_item' and action = 'deleted'
     limit 1;
    perform tests.assert(v_log.id is null, 'pas de « deleted » par item');

    select * into v_log from public.activity_log
     where household_id = tests.hh() and action = 'cleared' and created_at = now();
    perform tests.assert(v_log.actor_id = v_me and v_log.entity_label = 'Épicerie'
      and v_log.tool_key = 'shopping' and (v_log.payload ->> 'count')::int = 3, 'une seule ligne « cleared »');

    perform tests.assert(public.clear_checked(tests.list()) = 0, 'rien à vider la deuxième fois');
    perform tests.assert((select count(*) from public.activity_log
      where household_id = tests.hh() and action = 'cleared' and created_at = now()) = 1, 'pas de journal pour zéro item');

    -- Les écritures suivantes sont de nouveau journalisées.
    update public.checklist_item set checked = true where checklist_id = tests.list() and label = 'Café';
    perform tests.assert(exists (select 1 from public.activity_log
      where household_id = tests.hh() and action = 'checked' and entity_label = 'Café' and created_at = now()),
      'le journal reprend après l''action groupée');

    perform tests.ok('clear_checked range les cochés et journalise une seule fois');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

do $$
begin
  perform tests.create_user('intrus@example.com', 'Intrus');
  perform tests.login('intrus@example.com');
  perform tests.throws(format('select public.clear_checked(%L)', tests.list()), '42501', 'liste d''un autre foyer');
  perform tests.login_anon();
  perform tests.throws(format('select public.clear_checked(%L)', tests.list()), '42501', 'anonyme');
  perform tests.ok('clear_checked refuse un non-membre et l''anonyme');
end $$;
