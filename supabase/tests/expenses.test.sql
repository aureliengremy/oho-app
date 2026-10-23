-- Tests de l'outil Dépenses : sommes au centime, taux figé, soldes, RPC, accès.
-- Chaque bloc annule ses écritures (exception rattrapée) pour laisser le seed intact.

create or replace function tests.book() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-000000120001'::uuid $$;
create or replace function tests.daily() returns uuid language sql immutable
  as $$ select '0192f000-0000-7000-8000-000000120002'::uuid $$;

do $$
declare
  v_al uuid := tests.user_id('aurelien@example.com');
  v_an uuid := tests.user_id('auriane@example.com');
begin
  perform tests.login('auriane@example.com');
  -- Lisbonne : Auriane a payé 1 702,40 + 14,59, Aurélien 1 486,00 ; parts 1 601,50 / 1 601,49.
  perform tests.assert((select balance_cents from public.expense_balance where book_id = tests.book() and user_id = v_an) = 11549,
    'Auriane doit recevoir 115,49 $');
  perform tests.assert((select balance_cents from public.expense_balance where book_id = tests.book() and user_id = v_al) = -11549,
    'Aurélien doit 115,49 $');
  -- Quotidien : 87,40 payés par Auriane, partagés, puis 64,75 remboursés par Aurélien.
  perform tests.assert((select balance_cents from public.expense_balance where book_id = tests.daily() and user_id = v_an) = 4370 - 6475,
    'le remboursement entre dans le solde');
  perform tests.assert((select sum(balance_cents) from public.expense_balance where book_id = tests.book()) = 0,
    'les soldes d''un carnet font zéro');
  perform tests.assert((select spent_cents from public.trip_budget_view where book_id = tests.book() and category = 'lodging') = 170240,
    'le budget du voyage voit le logement converti');
  perform tests.ok('soldes calculés : payé − dû + remboursé − reçu, et budget du voyage');
end $$;

do $$
begin
  perform tests.login('auriane@example.com');
  set constraints all immediate;
  perform tests.throws(format(
    'insert into public.expense (household_id, book_id, label, paid_by, amount_cents, currency) values (%L, %L, ''Seule'', %L, 1000, ''CAD'')',
    tests.hh(), tests.book(), auth.uid()), '23514', 'une dépense sans parts');
  perform tests.throws(format(
    'insert into public.expense (household_id, book_id, label, paid_by, amount_cents, currency) values (%L, %L, ''Négative'', %L, -5, ''CAD'')',
    tests.hh(), tests.book(), auth.uid()), '23514', 'un montant négatif (M17)');
  perform tests.throws(format(
    'insert into public.settlement (household_id, book_id, from_user, to_user, amount_cents) values (%L, %L, %L, %L, 100)',
    tests.hh(), tests.book(), auth.uid(), auth.uid()), '23514', 'se rembourser soi-même');
  perform tests.throws(format(
    'insert into public.expense_book (household_id, name, trip_id, sort_order) values (%L, ''Bis'', %L, 9)',
    tests.hh(), '0192f000-0000-7000-8000-0000000e0001'), '23505', 'deux carnets pour un voyage (M18)');
  perform tests.ok('dépenses : parts obligatoires, montants positifs, un carnet par voyage');
end $$;

do $$
declare
  v_al uuid := tests.user_id('aurelien@example.com');
  v_an uuid;
  v_id uuid := '0192f000-0000-7000-8000-0000001300ff';
begin
  v_an := tests.login('auriane@example.com');
  begin
    -- 10,00 € à 1,5 = 15,00 $, en deux : 7,50 / 7,50.
    perform public.save_expense(
      jsonb_build_object('id', v_id, 'household_id', tests.hh(), 'book_id', tests.book(), 'label', 'Tram 28',
        'paid_by', v_al, 'amount_cents', 1000, 'currency', 'EUR', 'fx_rate', 1.5, 'category', 'transport'),
      jsonb_build_array(jsonb_build_object('user_id', v_al, 'share_cents', 750), jsonb_build_object('user_id', v_an, 'share_cents', 750)));
    set constraints all immediate;
    perform tests.assert((select book_amount_cents from public.expense where id = v_id) = 1500, 'converti au taux figé');
    perform tests.assert((select created_by = v_an from public.expense where id = v_id), 'saisi par Auriane');

    -- Modifier d'un bloc (M19) : Aurélien seul paie sa part de 15 $, les anciennes parts tombent.
    set constraints all deferred;
    perform public.save_expense(
      jsonb_build_object('id', v_id, 'household_id', tests.hh(), 'book_id', tests.book(), 'label', 'Tram 28 (Aurélien)',
        'paid_by', v_al, 'amount_cents', 1000, 'currency', 'EUR', 'fx_rate', 1.5, 'category', 'transport', 'split_mode', 'amounts'),
      jsonb_build_array(jsonb_build_object('user_id', v_al, 'share_cents', 1500), jsonb_build_object('user_id', v_an, 'share_cents', 0)));
    set constraints all immediate;
    perform tests.assert((select count(*) from public.expense_share where expense_id = v_id and deleted_at is null) = 2, 'deux parts vivantes');
    perform tests.assert((select count(*) from public.expense_share where expense_id = v_id and deleted_at is not null) = 2, 'deux pierres tombales');
    perform tests.assert(exists (select 1 from public.activity_log where entity_id = v_id and tool_key = 'expenses' and action = 'updated'
      and actor_id = v_an), 'la modification de la dépense d''Aurélien est tracée (M22)');

    set constraints all deferred;
    perform tests.throws(format($q$select public.save_expense(
      jsonb_build_object('id', %L, 'household_id', %L, 'book_id', %L, 'label', 'Faux', 'paid_by', %L,
        'amount_cents', 1000, 'currency', 'CAD'),
      jsonb_build_array(jsonb_build_object('user_id', %L, 'share_cents', 999)))$q$, gen_random_uuid(), tests.hh(), tests.book(), v_al, v_al)
      || '; set constraints all immediate', '23514', 'un centime manquant');
    perform tests.ok('save_expense : convertit, remplace les parts d''un bloc et refuse un centime de trop ou de moins');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

do $$
declare
  v_id uuid := '0192f000-0000-7000-8000-0000001300fe';
  v_an uuid;
begin
  v_an := tests.login('auriane@example.com');
  begin
    perform public.save_expense(
      jsonb_build_object('id', v_id, 'household_id', tests.hh(), 'book_id', tests.book(), 'label', 'Bica',
        'paid_by', v_an, 'amount_cents', 250, 'currency', 'CAD', 'fx_rate', 1.7),
      jsonb_build_array(jsonb_build_object('user_id', v_an, 'share_cents', 250)));
    set constraints all immediate;
    perform tests.assert((select fx_rate from public.expense where id = v_id) = 1, 'même devise : taux 1');
    perform tests.ok('dans la devise du carnet, le taux vaut 1 quoi qu''envoie le client');
    raise exception 'annuler' using errcode = 'OHO01';
  exception when sqlstate 'OHO01' then null;
  end;
end $$;

-- Ce fichier passe avant rls.test.sql : il crée lui-même le compte hors espace.
do $$ begin perform tests.create_user('intrus@example.com', 'Intrus'); end $$;

do $$
begin
  perform tests.login('intrus@example.com');
  perform tests.assert((select count(*) from public.expense_balance) = 0, 'aucun solde');
  perform tests.assert((select count(*) from public.trip_budget_view) = 0, 'aucun budget');
  perform tests.throws(format($q$select public.save_expense(
    jsonb_build_object('household_id', %L, 'book_id', %L, 'label', 'Pirate', 'paid_by', %L, 'amount_cents', 100, 'currency', 'CAD'),
    jsonb_build_array(jsonb_build_object('user_id', %L, 'share_cents', 100)))$q$,
    tests.hh(), tests.book(), auth.uid(), auth.uid()), '42501', 'intrus enregistre une dépense');
  perform tests.ok('dépenses invisibles et intouchables hors du foyer');
end $$;
